import { Observable } from "rxjs";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, BSLaunchWarning, LaunchOption } from "../../../shared/models/bs-launch";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { SteamService } from "../steam.service";
import path from "node:path";
import { BS_EXECUTABLE } from "../../constants";
import log from "electron-log";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { UtilsService } from "../utils.service";
import { LinuxService } from "../linux.service";
import { spawn, ChildProcess, SpawnOptions } from "node:child_process";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { app } from "electron";
import { buildWindowsPowerShellArgs, getWindowsPowerShellPath } from "main/helpers/windows-powershell.helper";
import { LaunchPlan, planLaunch } from "./launch-plan";
import { closeOnLaunch, defaultGameLauncherPorts, GameLauncherPorts, launchContext, launchGame } from "./launcher-ports";
import { launchOwnedProcess, OwnedProcessSession } from "./owned-process-session";

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

function waitForElevatedHelperPid(
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

export type SteamLauncherPorts = GameLauncherPorts & {
    steam: Pick<SteamService, "isSteamRunning" | "openSteam" | "getSteamPath">;
    linux: Pick<LinuxService, "getProtonConfig">;
    adminHelperPath(): string;
    logsPath(): string;
    spawnElevation(command: string, args: string[], options: SpawnOptions): ChildProcess;
};

export function defaultSteamLauncherPorts(): SteamLauncherPorts {
    const util = UtilsService.getInstance();
    return {
        ...defaultGameLauncherPorts(),
        steam: SteamService.getInstance(),
        linux: LinuxService.getInstance(),
        adminHelperPath: () => path.resolve(util.getAssetsScriptsPath(), "start_beat_saber_admin.exe"),
        logsPath: () => app.getPath("logs"),
        spawnElevation: (command, args, options) => spawn(command, args, options),
    };
}

export class SteamLauncherService implements StoreLauncherInterface{

    private static instance: SteamLauncherService;

    public static getInstance(): SteamLauncherService{
        if(!SteamLauncherService.instance){
            SteamLauncherService.instance = new SteamLauncherService();
        }
        return SteamLauncherService.instance;
    }

    public constructor(private readonly ports: SteamLauncherPorts = defaultSteamLauncherPorts()){}

    private launchElevatedBeatSaber(
        elevated: NonNullable<LaunchPlan["elevated"]>,
        options: SpawnOptions
    ): Promise<OwnedProcessSession> {
        return launchOwnedProcess({
            executablePath: elevated.exePath,
            spawn: ({ signal }) => {
                const helperArgs = [
                    elevated.exePath,
                    ...elevated.args,
                    "--log-path",
                    path.join(this.ports.logsPath(), "bs-admin-start.log"),
                ];
                const elevationScript = buildAdminElevationScript(this.ports.adminHelperPath(), helperArgs);
                const adminProcess = this.ports.spawnElevation(
                    getWindowsPowerShellPath(),
                    buildWindowsPowerShellArgs(elevationScript),
                    {
                        ...options,
                        detached: true,
                        shell: false,
                        stdio: ["ignore", "pipe", "ignore"],
                        windowsHide: true,
                    }
                );
                return { process: adminProcess, launcherPid: waitForElevatedHelperPid(adminProcess, signal) };
            },
            onStarted: closeOnLaunch(this.ports),
        }, this.ports.session);
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{

        return new Observable<BSLaunchEventData>(obs => {(async () => {

            const bsFolderPath = await this.ports.localVersions.getInstalledVersionPath(launchOptions.version);
            const bsExePath = path.join(bsFolderPath, BS_EXECUTABLE);

            if(!(await this.ports.pathExists(bsExePath))){
                throw CustomError.fromError(new Error(`Path not exist : ${bsExePath}`), BSLaunchError.BS_NOT_FOUND);
            }

            const skipSteam = launchOptions.launchMods?.includes(LaunchMods.SKIP_STEAM) ?? false;
            const { steam } = this.ports;

            // Open Steam if not running
            if(!skipSteam && !(await steam.isSteamRunning())){

                obs.next({type: BSLaunchEvent.STEAM_LAUNCHING});

                await steam.openSteam().then(() => {
                    obs.next({type: BSLaunchEvent.STEAM_LAUNCHED});
                }).catch(e => {
                    log.error(e);
                    obs.next({type: BSLaunchWarning.UNABLE_TO_LAUNCH_STEAM});
                });
            }

            const plan = await planLaunch(
                { store: "steam", launchOptions, gameFolder: bsFolderPath },
                launchContext(this.ports, async () => this.ports.linux.getProtonConfig(
                    await steam.getSteamPath(), { createCompatData: true }
                ))
            );

            if (launchOptions.admin && !plan.elevated) {
                log.warn("Launching as admin is not supported on Linux! Starting the game as a normal user.");
            }

            obs.next({type: BSLaunchEvent.BS_LAUNCHING});

            try {
                const session = plan.elevated
                    ? await this.launchElevatedBeatSaber(plan.elevated, { env: plan.env, cwd: bsFolderPath })
                    : await launchGame(this.ports, plan, bsFolderPath);
                const exitCode = await session.exit;
                log.info("BS process exit code", exitCode);
            }
            catch(err: unknown) {
                throw CustomError.fromError(toLaunchError(err), BSLaunchError.BS_EXIT_ERROR);
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
