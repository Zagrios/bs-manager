import { Observable } from "rxjs";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, BSLaunchWarning, LaunchOption } from "../../../shared/models/bs-launch";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { pathExists } from "fs-extra";
import { SteamService } from "../steam.service";
import path from "node:path";
import { BS_APP_ID, BS_EXECUTABLE } from "../../constants";
import log from "electron-log";
import {
    AbstractLauncherService,
    buildBsLaunchArgs,
    LaunchBeatSaberOptions,
    OwnedProcessIdentity,
    ProcessOwnershipSnapshot,
} from "./abstract-launcher.service";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { UtilsService } from "../utils.service";
import { spawn, ChildProcess, SpawnOptions } from "node:child_process";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { app } from "electron";
import { parseLaunchOptions } from "main/helpers/launchOptions.helper";
import { buildWindowsPowerShellArgs, getWindowsPowerShellPath } from "main/helpers/windows-powershell.helper";

const ELEVATED_HELPER_PID_TIMEOUT_MS = 60_000;
const ELEVATED_HELPER_PID_PREFIX = "BSM_ADMIN_HELPER_PID:";

function toLaunchError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }
    if (typeof error === "string") {
        return new Error(error);
    }
    if (error === undefined) {
        return new Error("undefined");
    }
    if (error === null) {
        return new Error("null");
    }
    if (typeof error === "number" || typeof error === "boolean"
        || typeof error === "bigint" || typeof error === "symbol") {
        return new Error(error.toString());
    }
    if (typeof error === "function") {
        return new Error(Function.prototype.toString.call(error));
    }
    try {
        return new Error(JSON.stringify(error) ?? Object.prototype.toString.call(error));
    } catch {
        return new Error(Object.prototype.toString.call(error));
    }
}

class SteamLaunchFailure extends Error {
    public readonly launchError: Error;

    constructor(error: unknown) {
        const launchError = toLaunchError(error);
        super(launchError.message);
        this.name = "SteamLaunchFailure";
        this.stack = launchError.stack;
        this.launchError = launchError;
    }
}

class ElevatedHelperPidError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ElevatedHelperPidError";
    }
}

function buildAdminElevationScript(helperExecutablePath: string, helperArguments: string[]): string {
    const encode = (value: string) => Buffer.from(value, "utf8").toString("base64");
    const encodedArguments = encode(JSON.stringify(helperArguments));

    return String.raw`$HelperExecutablePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(helperExecutablePath)}'))
$HelperArgumentsJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedArguments}'))
$HelperArguments = @((ConvertFrom-Json -InputObject $HelperArgumentsJson))

function ConvertTo-NativeArgument([AllowEmptyString()][string]$Value) {
    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') {
        return $Value
    }

    $result = New-Object System.Text.StringBuilder
    [void]$result.Append('"')
    $backslashCount = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq [char]92) {
            $backslashCount++
            continue
        }
        if ($character -eq [char]34) {
            [void]$result.Append(('\' * (($backslashCount * 2) + 1)))
            [void]$result.Append('"')
            $backslashCount = 0
            continue
        }
        if ($backslashCount -gt 0) {
            [void]$result.Append(('\' * $backslashCount))
            $backslashCount = 0
        }
        [void]$result.Append($character)
    }
    if ($backslashCount -gt 0) {
        [void]$result.Append(('\' * ($backslashCount * 2)))
    }
    [void]$result.Append('"')
    return $result.ToString()
}

$HelperArgumentLine = (($HelperArguments | ForEach-Object { ConvertTo-NativeArgument ([string]$_) }) -join ' ')
try {
    $HelperProcess = Start-Process -FilePath $HelperExecutablePath -ArgumentList $HelperArgumentLine -Verb RunAs -PassThru -ErrorAction Stop
}
catch {
    exit 1223
}

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    [Console]::Out.WriteLine('${ELEVATED_HELPER_PID_PREFIX}' + $HelperProcess.Id)
}
catch {
    exit 87
}

$HelperProcess.WaitForExit()
exit [int]$HelperProcess.ExitCode
`;
}

export class SteamLauncherService extends AbstractLauncherService implements StoreLauncherInterface{

    private static instance: SteamLauncherService;

    public static getInstance(): SteamLauncherService{
        if(!SteamLauncherService.instance){
            SteamLauncherService.instance = new SteamLauncherService();
        }
        return SteamLauncherService.instance;
    }

    private readonly steam: SteamService;
    private readonly util: UtilsService;

    private constructor(){
        super();
        this.steam = SteamService.getInstance();
        this.util = UtilsService.getInstance();
    }

    private createOwnershipCleanup(
        ownershipLifecycle: AbortController,
        getWillQuitHandler: () => () => void
    ): () => void {
        let cleanedUp = false;
        return () => {
            if (cleanedUp) { return; }
            cleanedUp = true;
            ownershipLifecycle.abort();
            app.removeListener("will-quit", getWillQuitHandler());
        };
    }

    private getStartBsAsAdminExePath(): string {
        return path.resolve(this.util.getAssetsScriptsPath(), "start_beat_saber_admin.exe");
    }

    private waitForElevatedHelperPid(
        elevationProcess: ChildProcess,
        signal?: AbortSignal
    ): Promise<number> {
        return new Promise((resolve, reject) => {
            const { stdout } = elevationProcess;
            if (!stdout) {
                reject(new ElevatedHelperPidError("PowerShell elevation did not expose a helper PID channel"));
                return;
            }

            let settled = false;
            let output = "";
            let exitCode: number | null | undefined;
            const cleanup = () => {
                clearTimeout(timeout);
                stdout.removeListener("data", onData);
                elevationProcess.removeListener("error", onError);
                elevationProcess.removeListener("exit", onExit);
                elevationProcess.removeListener("close", onClose);
                signal?.removeEventListener("abort", onAbort);
            };
            const settle = (error?: Error, helperPid?: number) => {
                if (settled) { return; }
                settled = true;
                cleanup();
                if (error) {
                    reject(error);
                } else {
                    resolve(helperPid!);
                }
            };
            const readHelperPid = (): number | undefined => {
                const helperPidPattern = new RegExp(String.raw`${ELEVATED_HELPER_PID_PREFIX}(\d+)`);
                const match = helperPidPattern.exec(output.replaceAll("\0", ""));
                const helperPid = match && Number(match[1]);
                return Number.isSafeInteger(helperPid) && (helperPid ?? 0) > 0
                    ? helperPid!
                    : undefined;
            };
            const onData = (chunk: Buffer | string) => {
                output += chunk.toString();
                const helperPid = readHelperPid();
                if (helperPid !== undefined) {
                    settle(undefined, helperPid);
                }
            };
            const onError = (error: Error) => settle(new ElevatedHelperPidError(
                `Could not start Windows PowerShell elevation: ${error.message}`
            ));
            const onExit = (code: number | null) => {
                exitCode = code;
            };
            const finishPidChannel = (code = exitCode) => {
                const helperPid = readHelperPid();
                if (helperPid !== undefined) {
                    settle(undefined, helperPid);
                    return;
                }
                settle(new ElevatedHelperPidError(
                    `Windows PowerShell elevation exited before reporting the helper PID (code ${code ?? "null"})`
                ));
            };
            const onClose = (code: number | null) => finishPidChannel(code);
            const onAbort = () => settle(new ElevatedHelperPidError(
                "Elevated helper PID acquisition was cancelled"
            ));
            const timeout = setTimeout(() => settle(new ElevatedHelperPidError(
                "Elevated helper PID acquisition timed out"
            )), ELEVATED_HELPER_PID_TIMEOUT_MS);

            stdout.on("data", onData);
            elevationProcess.once("error", onError);
            elevationProcess.once("exit", onExit);
            elevationProcess.once("close", onClose);
            signal?.addEventListener("abort", onAbort, { once: true });
            if (signal?.aborted) {
                onAbort();
            }
        });
    }

    private async launchBeatSaberAsAdmin(
        bsExePath: string,
        launchArgs: string[],
        options: SpawnOptions
    ): Promise<number> {
        const ownershipSnapshot = await this.createProcessOwnershipSnapshot();
        const ownershipLifecycle = new AbortController();
        const helperArgs = [
            bsExePath,
            ...launchArgs,
            "--log-path",
            path.join(app.getPath("logs"), "bs-admin-start.log"),
        ];
        const elevationScript = buildAdminElevationScript(
            this.getStartBsAsAdminExePath(),
            helperArgs
        );
        const adminProcess = spawn(getWindowsPowerShellPath(), buildWindowsPowerShellArgs(elevationScript), {
            ...options,
            detached: true,
            shell: false,
            stdio: ["ignore", "pipe", "ignore"],
            windowsHide: true,
        });

        const cleanup = this.createOwnershipCleanup(ownershipLifecycle, () => onWillQuitHandler);
        const unrefAdminProcess = () => {
            adminProcess.stdout?.destroy();
            if (!adminProcess.killed) {
                adminProcess.unref();
            }
        };
        const onWillQuitHandler = () => {
            cleanup();
            unrefAdminProcess();
        };
        app.on("will-quit", onWillQuitHandler);

        const elevatedHelperPid = this.waitForElevatedHelperPid(
            adminProcess,
            ownershipLifecycle.signal
        );
        const helperPidOutcome = elevatedHelperPid.then(
            helperPid => ({ helperPid }),
            error => ({ error })
        );

        const ownership = ownershipSnapshot
            ? elevatedHelperPid.then(helperPid => this.findOwnedProcess(
                    ownershipSnapshot.existingProcessIds,
                    bsExePath,
                    ownershipSnapshot.launchedAfter,
                    helperPid,
                    ownershipLifecycle.signal
                ))
            : Promise.resolve(undefined);
        ownership.then(processIdentity => {
            if (processIdentity && !ownershipLifecycle.signal.aborted) {
                this.handleOwnedProcessStarted(processIdentity, ownershipLifecycle.signal);
            }
        }).catch(error => log.error("Could not handle the elevated Beat Saber process", error));

        const helperExit = new Promise<number>((resolve, reject) => {
            let settled = false;
            adminProcess.once("error", err => {
                if (settled) { return; }
                settled = true;
                log.error("Error while starting BS as Admin", err);
                ownershipLifecycle.abort();
                reject(err);
            });
            adminProcess.once("exit", code => {
                if (settled) { return; }
                settled = true;
                resolve(code ?? -1);
            });
        });
        const helperOutcome = helperExit.then(
            exitCode => ({ exitCode }),
            error => ({ error })
        );

        const helperPidResult = await helperPidOutcome;
        if ("error" in helperPidResult) {
            cleanup();
            unrefAdminProcess();
            throw new SteamLaunchFailure(helperPidResult.error);
        }
        const helperResult = await helperOutcome;
        if ("error" in helperResult) {
            cleanup();
            throw new SteamLaunchFailure(helperResult.error);
        }
        let processIdentity: OwnedProcessIdentity | undefined;
        try {
            processIdentity = await ownership;
        } catch (error) {
            cleanup();
            throw new SteamLaunchFailure(error);
        }
        if (!processIdentity) {
            cleanup();
            return helperResult.exitCode;
        }

        try {
            await this.waitForOwnedProcessExit(
                bsExePath,
                processIdentity,
                ownershipLifecycle.signal
            );
            return 0;
        } finally {
            cleanup();
        }
    }

    private async launchTrackedBeatSaber(
        options: LaunchBeatSaberOptions,
        ownershipSnapshot?: ProcessOwnershipSnapshot
    ): Promise<number> {
        const wrapperProcess = this.launchBeatSaberProcess({
            ...options,
            ownershipToken: ownershipSnapshot?.launchToken,
        });
        const executablePath = path.join(options.beatSaberFolderPath, BS_EXECUTABLE);
        const ownershipLifecycle = new AbortController();

        const cleanup = this.createOwnershipCleanup(ownershipLifecycle, () => onWillQuitHandler);
        const unrefWrapper = () => {
            if (!wrapperProcess.killed) {
                wrapperProcess.unref();
            }
        };
        const onWillQuitHandler = () => {
            cleanup();
            unrefWrapper();
        };
        app.on("will-quit", onWillQuitHandler);

        const ownership = ownershipSnapshot
            ? this.findOwnedProcess(
                ownershipSnapshot.existingProcessIds,
                executablePath,
                ownershipSnapshot.launchedAfter,
                wrapperProcess.pid,
                ownershipLifecycle.signal,
                ownershipSnapshot.launchToken
            )
            : Promise.resolve(undefined);
        ownership.then(processIdentity => {
            if (processIdentity && !ownershipLifecycle.signal.aborted) {
                this.handleOwnedProcessStarted(processIdentity, ownershipLifecycle.signal);
            }
        }).catch(error => log.error("Could not handle the launched Beat Saber process", error));

        const wrapperExit = new Promise<number>((resolve, reject) => {
            let settled = false;
            wrapperProcess.once("error", err => {
                if (settled) { return; }
                settled = true;
                log.error("Error while launching BS", err);
                ownershipLifecycle.abort();
                reject(err);
            });
            wrapperProcess.once("exit", code => {
                if (settled) { return; }
                settled = true;
                log.info(`BS wrapper process exit with code ${code}`);
                resolve(code ?? -1);
            });
        });
        const wrapperOutcome = wrapperExit.then(
            exitCode => ({ exitCode }),
            error => ({ error })
        );

        let processIdentity: OwnedProcessIdentity | undefined;
        try {
            processIdentity = await ownership;
        } catch (error) {
            cleanup();
            throw new SteamLaunchFailure(error);
        }
        if (!processIdentity) {
            const wrapperResult = await wrapperOutcome;
            if ("error" in wrapperResult) {
                cleanup();
                throw new SteamLaunchFailure(wrapperResult.error);
            }
            cleanup();
            return wrapperResult.exitCode;
        }

        try {
            await this.waitForOwnedProcessExit(
                executablePath,
                processIdentity,
                ownershipLifecycle.signal
            );
            return 0;
        } finally {
            cleanup();
        }
    }

    private async launchBeatSaberNormally(options: LaunchBeatSaberOptions): Promise<number> {
        const ownershipSnapshot = await this.createProcessOwnershipSnapshot();
        return this.launchTrackedBeatSaber(options, ownershipSnapshot);
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{

        return new Observable<BSLaunchEventData>(obs => {(async () => {

            const bsFolderPath = await this.localVersions.getInstalledVersionPath(launchOptions.version);
            const bsExePath = path.join(bsFolderPath, BS_EXECUTABLE);

            if(!(await pathExists(bsExePath))){
                throw CustomError.fromError(new Error(`Path not exist : ${bsExePath}`), BSLaunchError.BS_NOT_FOUND);
            }

            const skipSteam = launchOptions.launchMods?.includes(LaunchMods.SKIP_STEAM) ?? false;

            // Open Steam if not running
            if(!skipSteam && !(await this.steam.isSteamRunning())){

                obs.next({type: BSLaunchEvent.STEAM_LAUNCHING});

                await this.steam.openSteam().then(() => {
                    obs.next({type: BSLaunchEvent.STEAM_LAUNCHED});
                }).catch(e => {
                    log.error(e);
                    obs.next({type: BSLaunchWarning.UNABLE_TO_LAUNCH_STEAM});
                });
            }

            const isFpfc = launchOptions.launchMods?.includes(LaunchMods.FPFC);
            const isOculus = launchOptions.launchMods?.includes(LaunchMods.OCULUS);

            const steamPath = await this.steam.getSteamPath();

            const env: Record<string, string> = {
                ...process.env,
                "SteamAppId": BS_APP_ID,
                "SteamOverlayGameId": BS_APP_ID,
                "SteamGameId": BS_APP_ID,
            };

            // Linux setup
            if (process.platform === "linux") {
                if (launchOptions.admin) {
                    log.warn("Launching as admin is not supported on Linux! Starting the game as a normal user.");
                    launchOptions.admin = false;
                }

                Object.assign(env, await this.linux.buildEnvVariables(
                    launchOptions, steamPath, bsFolderPath
                ));
            }

            const {
                env: customEnv,
                cmdlet, args
            } = parseLaunchOptions(launchOptions.command, {
                commandReplacement: process.platform === "win32"
                    ? `"${bsExePath}"`
                    : `${await this.linux.getProtonPrefix()} "${bsExePath}"`,
            });
            this.updateEnvVariables(env, customEnv);

            const launchArgs = buildBsLaunchArgs(launchOptions);

            if (isFpfc && !isOculus) {
                env.VR_OVERRIDE = bsExePath;
                env.XR_RUNTIME_JSON = path.join(bsExePath, "disabled-openxr.json");
                launchArgs.push("-vrmode", "None");
            }

            obs.next({type: BSLaunchEvent.BS_LAUNCHING});

            const spawnOpts = { env: { ...customEnv, ...env }, cwd: bsFolderPath };

            const launchPromise = !launchOptions.admin ? (
                this.launchBeatSaberNormally({
                    env, customEnv, cmdlet,
                    args: args
                        ? [ args, ...launchArgs ]
                        : launchArgs,
                    beatSaberFolderPath: bsFolderPath,
                })
            ) : this.launchBeatSaberAsAdmin(bsExePath, launchArgs, spawnOpts);

            try {
                const exitCode = await launchPromise;
                log.info("BS process exit code", exitCode);
            }
            catch(err: any) {
                throw CustomError.fromError(
                    err instanceof SteamLaunchFailure ? err.launchError : err,
                    BSLaunchError.BS_EXIT_ERROR
                );
            }

        })().then(() => {
            obs.complete();
        }).catch(err => {
            if(err instanceof CustomError){
                obs.error(err);
            } else {
                obs.error(CustomError.fromError(err, BSLaunchError.UNKNOWN_ERROR));
            }
        })});
    }

}
