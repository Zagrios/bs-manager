import { Observable } from "rxjs";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, BSLaunchWarning, LaunchOption } from "../../../shared/models/bs-launch";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { pathExists, removeSync, rename } from "fs-extra";
import { SteamService } from "../steam.service";
import path from "path";
import { BS_APP_ID, BS_EXECUTABLE, STEAMVR_APP_ID } from "../../constants";
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
import { spawn, ChildProcess, SpawnOptions } from "child_process";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { app, Event } from "electron";
import { parseLaunchOptions } from "main/helpers/launchOptions.helper";
import { randomUUID } from "crypto";
import { buildWindowsPowerShellArgs, getWindowsPowerShellPath } from "main/helpers/windows-powershell.helper";

const STEAM_VR_WATCHER_READY_TIMEOUT_MS = 5_000;
const STEAM_VR_WATCHER_READY_POLL_INTERVAL_MS = 50;
const STEAM_VR_RESTORE_HANDOFF_TIMEOUT_MS = 7_500;
const ELEVATED_HELPER_PID_TIMEOUT_MS = 60_000;
const ELEVATED_HELPER_PID_PREFIX = "BSM_ADMIN_HELPER_PID:";

type SteamLaunchCompletion = {
    exitCode: number;
    steamVrRestoreSafe: boolean;
};

class SteamLaunchFailure extends Error {
    public readonly launchError: Error;

    constructor(error: unknown, public readonly steamVrRestoreSafe: boolean) {
        const launchError = error instanceof Error ? error : new Error(String(error));
        super(launchError.message);
        this.name = "SteamLaunchFailure";
        this.stack = launchError.stack;
        this.launchError = launchError;
    }
}

class ElevatedHelperPidError extends Error {
    constructor(message: string, public readonly steamVrRestoreSafe: boolean) {
        super(message);
        this.name = "ElevatedHelperPidError";
    }
}

function buildAdminElevationScript(helperExecutablePath: string, helperArguments: string[]): string {
    const encode = (value: string) => Buffer.from(value, "utf8").toString("base64");
    const encodedArguments = encode(JSON.stringify(helperArguments));

    return `$HelperExecutablePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(helperExecutablePath)}'))
$HelperArgumentsJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedArguments}'))
$HelperArguments = @((ConvertFrom-Json -InputObject $HelperArgumentsJson))

function ConvertTo-NativeArgument([AllowEmptyString()][string]$Value) {
    if ($Value.Length -gt 0 -and $Value -notmatch '[\\s"]') {
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
            [void]$result.Append(('\\' * (($backslashCount * 2) + 1)))
            [void]$result.Append('"')
            $backslashCount = 0
            continue
        }
        if ($backslashCount -gt 0) {
            [void]$result.Append(('\\' * $backslashCount))
            $backslashCount = 0
        }
        [void]$result.Append($character)
    }
    if ($backslashCount -gt 0) {
        [void]$result.Append(('\\' * ($backslashCount * 2)))
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

const STEAM_VR_RESTORE_WATCHER_SCRIPT = `
function Get-TargetProcessState {
    $processCandidate = Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($null -eq $processCandidate) {
        return 'Exited'
    }

    try {
        $processStartedAtUtc = $processCandidate.StartTime.ToUniversalTime()
        $startTimeMatches = $processStartedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") -eq
            $TargetProcessStartedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        $pathMatches = $true
        try {
            $processPath = $processCandidate.Path
            if ($null -ne $processPath) {
                $pathMatches = $processPath -ieq $TargetExecutablePath
            }
        }
        catch {
        }

        if (!$pathMatches -or !$startTimeMatches) {
            return 'Exited'
        }

        return 'Owned'
    }
    catch {
        return 'Uncertain'
    }
}

$targetState = Get-TargetProcessState
if ($targetState -eq 'Uncertain') {
    exit 2
}

try {
    [System.IO.File]::WriteAllText($HandoffReadyPath, "$TargetProcessId")
}
catch {
    exit 4
}

if ($targetState -eq 'Owned') {
    while ($targetState -eq 'Owned') {
        Start-Sleep -Seconds 1
        $targetState = Get-TargetProcessState
    }
}

if ($targetState -eq 'Uncertain') {
    exit 2
}

if ($targetState -ne 'Exited') {
    exit 2
}

for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if (!(Test-Path -LiteralPath $SteamVrBackupPath)) {
        exit 0
    }

    if (!(Test-Path -LiteralPath $SteamVrFolderPath)) {
        try {
            Move-Item -LiteralPath $SteamVrBackupPath -Destination $SteamVrFolderPath -ErrorAction Stop
            exit 0
        }
        catch {
        }
    }

    Start-Sleep -Seconds 1
}

exit 3
`;

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

    private getSteamVRPath(): Promise<string> {
        return this.steam.getGameFolder(STEAMVR_APP_ID, "SteamVR");
    }

    private timedRename(src: string, dest: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Rename timed out")), 5000);
            rename(src, dest).then(resolve, reject).finally(() => clearTimeout(timeout));
        });
    }

    private async backupSteamVR(): Promise<boolean> {
        const steamVrFolder = await this.getSteamVRPath();
        if (!steamVrFolder || !(await pathExists(steamVrFolder))) {
            return false;
        }
        try {
            await this.timedRename(steamVrFolder, `${steamVrFolder}.bak`);
            return false;
        } catch (err: any) {
            log.warn("Could not backup SteamVR folder, skipping", err);
            return err?.code === "EPERM" || err?.message?.includes("timed out");
        }
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
                reject(new ElevatedHelperPidError("PowerShell elevation did not expose a helper PID channel", false));
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
                const match = output.replaceAll("\0", "").match(new RegExp(`${ELEVATED_HELPER_PID_PREFIX}(\\d+)`));
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
                `Could not start Windows PowerShell elevation: ${error.message}`,
                true
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
                    `Windows PowerShell elevation exited before reporting the helper PID (code ${code ?? "null"})`,
                    code === 1223
                ));
            };
            const onClose = (code: number | null) => finishPidChannel(code);
            const onAbort = () => settle(new ElevatedHelperPidError(
                "Elevated helper PID acquisition was cancelled",
                false
            ));
            const timeout = setTimeout(() => settle(new ElevatedHelperPidError(
                "Elevated helper PID acquisition timed out",
                false
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

    public async restoreSteamVR(): Promise<void> {
        const steamVrFolder = await this.getSteamVRPath();
        if (!steamVrFolder) { return; }
        const steamVrBackup = `${steamVrFolder}.bak`;
        if (!(await pathExists(steamVrBackup))) { return; }
        return this.timedRename(steamVrBackup, steamVrFolder).catch(err => {
            log.warn("Could not restore SteamVR folder", err);
        });
    }

    private waitForRestorePreflight<T>(
        operation: Promise<T>,
        deadline: number,
        signal: AbortSignal,
        timeoutMessage: string
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0 || signal.aborted) {
                reject(new Error(timeoutMessage));
                return;
            }
            let settled = false;
            const cleanup = () => {
                clearTimeout(timeout);
                signal.removeEventListener("abort", onAbort);
            };
            const settle = (error?: unknown, value?: T) => {
                if (settled) { return; }
                settled = true;
                cleanup();
                if (error) {
                    reject(error);
                } else {
                    resolve(value!);
                }
            };
            const onAbort = () => settle(new Error(timeoutMessage));
            const timeout = setTimeout(onAbort, remainingMs);
            signal.addEventListener("abort", onAbort, { once: true });
            operation.then(value => settle(undefined, value), settle);
        });
    }

    private async restoreSteamVRBeforeQuit(): Promise<void> {
        const restoreLifecycle = new AbortController();
        const deadline = Date.now() + STEAM_VR_RESTORE_HANDOFF_TIMEOUT_MS;
        const timeout = setTimeout(() => restoreLifecycle.abort(), STEAM_VR_RESTORE_HANDOFF_TIMEOUT_MS);
        try {
            await this.waitForRestorePreflight(
                this.restoreSteamVR(),
                deadline,
                restoreLifecycle.signal,
                "SteamVR restore preflight timed out"
            );
        } finally {
            clearTimeout(timeout);
            restoreLifecycle.abort();
        }
    }

    private async waitForSteamVRWatcherReady(
        watcher: ChildProcess,
        readyPath: string,
        deadline: number,
        signal: AbortSignal
    ): Promise<void> {
        const readinessDeadline = Math.min(deadline, Date.now() + STEAM_VR_WATCHER_READY_TIMEOUT_MS);

        try {
            await new Promise<void>((resolve, reject) => {
                let pollTimer: NodeJS.Timeout | undefined;
                let checking = false;
                let settled = false;
                let terminalError: Error | undefined;

                const cleanup = () => {
                    if (pollTimer) {
                        clearTimeout(pollTimer);
                    }
                    watcher.removeListener("error", onError);
                    watcher.removeListener("exit", onExit);
                    signal.removeEventListener("abort", onAbort);
                };
                const settle = (error?: Error) => {
                    if (settled) { return; }
                    settled = true;
                    cleanup();
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                };
                const pollReady = async () => {
                    if (checking || settled) { return; }
                    checking = true;
                    try {
                        const ready = await this.waitForRestorePreflight(
                            pathExists(readyPath),
                            readinessDeadline,
                            signal,
                            "SteamVR restore watcher readiness timed out"
                        );
                        if (ready) {
                            settle();
                            return;
                        }
                        if (terminalError) {
                            settle(terminalError);
                            return;
                        }
                        const remainingMs = readinessDeadline - Date.now();
                        if (remainingMs <= 0) {
                            settle(new Error("SteamVR restore watcher readiness timed out"));
                            return;
                        }
                        pollTimer = setTimeout(pollReady, Math.min(STEAM_VR_WATCHER_READY_POLL_INTERVAL_MS, remainingMs));
                    } catch (error) {
                        settle(error instanceof Error ? error : new Error(String(error)));
                    } finally {
                        checking = false;
                    }
                };
                const failBeforeReady = (error: Error) => {
                    terminalError ??= error;
                    if (pollTimer) {
                        clearTimeout(pollTimer);
                        pollTimer = undefined;
                    }
                    pollReady();
                };
                const onError = (error: Error) => failBeforeReady(error);
                const onExit = (code: number | null, exitSignal: NodeJS.Signals | null) => {
                    failBeforeReady(new Error(`SteamVR restore watcher exited before readiness (code ${code ?? "null"}, signal ${exitSignal ?? "none"})`));
                };
                const onAbort = () => settle(new Error("SteamVR restore watcher readiness timed out"));

                watcher.once("error", onError);
                watcher.once("exit", onExit);
                signal.addEventListener("abort", onAbort, { once: true });
                pollReady();
            });
        } finally {
            try {
                removeSync(readyPath);
            } catch (error) {
                log.warn("Could not remove SteamVR watcher readiness file", error);
            }
        }
    }

    private async handoffSteamVRRestore(
        bsExePath: string,
        ownedProcess: OwnedProcessIdentity
    ): Promise<void> {
        const handoffLifecycle = new AbortController();
        const deadline = Date.now() + STEAM_VR_RESTORE_HANDOFF_TIMEOUT_MS;
        const timeout = setTimeout(() => handoffLifecycle.abort(), STEAM_VR_RESTORE_HANDOFF_TIMEOUT_MS);
        let watcher: ChildProcess | undefined;

        try {
            const steamVrFolder = await this.waitForRestorePreflight(
                this.getSteamVRPath(),
                deadline,
                handoffLifecycle.signal,
                "SteamVR restore handoff preflight timed out"
            );
            if (!steamVrFolder) { return; }
            const steamVrBackup = `${steamVrFolder}.bak`;
            const backupExists = await this.waitForRestorePreflight(
                pathExists(steamVrBackup),
                deadline,
                handoffLifecycle.signal,
                "SteamVR restore handoff preflight timed out"
            );
            if (!backupExists) { return; }
            const readyPath = path.join(app.getPath("temp"), `bsmanager-steamvr-restore-${randomUUID()}.ready`);

            const encode = (value: string) => Buffer.from(value, "utf8").toString("base64");
            const script = `$TargetExecutablePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(bsExePath)}'))
$SteamVrFolderPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(steamVrFolder)}'))
$SteamVrBackupPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(steamVrBackup)}'))
$HandoffReadyPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(readyPath)}'))
$TargetProcessId = ${ownedProcess.pid}
$TargetProcessStartedAtUtc = [DateTime]::Parse('${ownedProcess.startedAt.toISOString()}').ToUniversalTime()
${STEAM_VR_RESTORE_WATCHER_SCRIPT}`;
            watcher = spawn(getWindowsPowerShellPath(), buildWindowsPowerShellArgs(script), {
                detached: true,
                shell: false,
                stdio: "ignore",
                windowsHide: true,
            });
            watcher.once("error", error => log.error("SteamVR restore watcher error", error));
            watcher.once("exit", code => {
                if (code !== 0) {
                    log.error(`SteamVR restore watcher exited with code ${code}`);
                }
            });
            await this.waitForSteamVRWatcherReady(
                watcher,
                readyPath,
                deadline,
                handoffLifecycle.signal
            );
            watcher.removeAllListeners("error");
            watcher.removeAllListeners("exit");
            watcher.unref();
            watcher = undefined;
        } catch (error) {
            if (watcher) {
                watcher.removeAllListeners("error");
                watcher.removeAllListeners("exit");
                if (!watcher.killed) {
                    try {
                        watcher.kill();
                    } catch (killError) {
                        log.warn("Could not stop failed SteamVR restore watcher", killError);
                    }
                }
                try {
                    watcher.unref();
                } catch (unrefError) {
                    log.warn("Could not detach failed SteamVR restore watcher", unrefError);
                }
            }
            throw error;
        } finally {
            clearTimeout(timeout);
            handoffLifecycle.abort();
        }
    }

    private async launchBeatSaberAsAdmin(
        bsExePath: string,
        launchArgs: string[],
        options: SpawnOptions
    ): Promise<SteamLaunchCompletion> {
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
        let ownedProcess: OwnedProcessIdentity | undefined;
        let handoffPromise: Promise<void> | undefined;
        let quitCompletion: Promise<void> | undefined;
        let quitStarted = false;
        let cleanedUp = false;

        const cleanup = () => {
            if (cleanedUp) { return; }
            cleanedUp = true;
            ownershipLifecycle.abort();
            app.removeListener("will-quit", onWillQuitHandler);
        };
        const unrefAdminProcess = () => {
            adminProcess.stdout?.destroy();
            if (!adminProcess.killed) {
                adminProcess.unref();
            }
        };
        const startHandoff = (processIdentity: OwnedProcessIdentity) => {
            handoffPromise ??= this.handoffSteamVRRestore(bsExePath, processIdentity);
            return handoffPromise;
        };
        const onWillQuitHandler = async (event: Event) => {
            quitStarted = true;
            if (!ownedProcess) {
                cleanup();
                unrefAdminProcess();
                return;
            }

            event.preventDefault();
            quitCompletion ??= (async () => {
                try {
                    await startHandoff(ownedProcess!);
                } catch (error) {
                    log.error("Could not hand off SteamVR restoration", error);
                } finally {
                    cleanup();
                    unrefAdminProcess();
                    app.quit();
                }
            })();
            await quitCompletion;
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
            ownedProcess = processIdentity;
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
            throw new SteamLaunchFailure(
                helperPidResult.error,
                helperPidResult.error instanceof ElevatedHelperPidError
                    && helperPidResult.error.steamVrRestoreSafe
            );
        }
        const helperResult = await helperOutcome;
        if ("error" in helperResult) {
            cleanup();
            throw new SteamLaunchFailure(helperResult.error, false);
        }
        let processIdentity: OwnedProcessIdentity | undefined;
        try {
            processIdentity = await ownership;
        } catch (error) {
            cleanup();
            throw new SteamLaunchFailure(error, false);
        }
        if (!processIdentity) {
            cleanup();
            return {
                exitCode: helperResult.exitCode,
                steamVrRestoreSafe: false,
            };
        }

        try {
            const exitedSafely = await this.waitForOwnedProcessExit(
                bsExePath,
                processIdentity,
                ownershipLifecycle.signal
            );
            return {
                exitCode: 0,
                steamVrRestoreSafe: exitedSafely && !quitStarted,
            };
        } catch (error) {
            try {
                await startHandoff(processIdentity);
            } catch (handoffError) {
                log.error("Could not hand off SteamVR restoration after owned process monitoring failed", handoffError);
                throw new SteamLaunchFailure(new AggregateError(
                    [error, handoffError],
                    "Owned Beat Saber exit monitoring failed and SteamVR restore watcher handoff failed"
                ), false);
            }
            throw new SteamLaunchFailure(error, false);
        } finally {
            cleanup();
        }
    }

    private async launchTrackedBeatSaber(
        options: LaunchBeatSaberOptions,
        ownershipSnapshot?: ProcessOwnershipSnapshot
    ): Promise<SteamLaunchCompletion> {
        const wrapperProcess = this.launchBeatSaberProcess({
            ...options,
            ownershipToken: ownershipSnapshot?.launchToken,
        });
        const executablePath = path.join(options.beatSaberFolderPath, BS_EXECUTABLE);
        const ownershipLifecycle = new AbortController();
        let ownedProcess: OwnedProcessIdentity | undefined;
        let handoffPromise: Promise<void> | undefined;
        let quitCompletion: Promise<void> | undefined;
        let quitStarted = false;
        let cleanedUp = false;

        const cleanup = () => {
            if (cleanedUp) { return; }
            cleanedUp = true;
            ownershipLifecycle.abort();
            app.removeListener("will-quit", onWillQuitHandler);
        };
        const unrefWrapper = () => {
            if (!wrapperProcess.killed) {
                wrapperProcess.unref();
            }
        };
        const startWindowsHandoff = (processIdentity: OwnedProcessIdentity) => {
            handoffPromise ??= this.handoffSteamVRRestore(executablePath, processIdentity);
            return handoffPromise;
        };
        const onWillQuitHandler = async (event: Event) => {
            quitStarted = true;
            if (!ownedProcess) {
                cleanup();
                unrefWrapper();
                return;
            }

            event.preventDefault();
            quitCompletion ??= (async () => {
                try {
                    if (process.platform === "win32") {
                        await startWindowsHandoff(ownedProcess!);
                    } else {
                        await this.restoreSteamVRBeforeQuit();
                    }
                } catch (error) {
                    log.error("Could not restore SteamVR while quitting", error);
                } finally {
                    cleanup();
                    unrefWrapper();
                    app.quit();
                }
            })();
            await quitCompletion;
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
            ownedProcess = processIdentity;
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
            throw new SteamLaunchFailure(error, false);
        }
        if (!processIdentity) {
            const wrapperResult = await wrapperOutcome;
            cleanup();
            if ("error" in wrapperResult) {
                throw new SteamLaunchFailure(wrapperResult.error, true);
            }
            return {
                exitCode: wrapperResult.exitCode,
                steamVrRestoreSafe: false,
            };
        }

        try {
            const exitedSafely = await this.waitForOwnedProcessExit(
                executablePath,
                processIdentity,
                ownershipLifecycle.signal
            );
            return {
                exitCode: 0,
                steamVrRestoreSafe: exitedSafely && !quitStarted,
            };
        } catch (error) {
            if (process.platform !== "win32") {
                throw new SteamLaunchFailure(error, false);
            }
            try {
                await startWindowsHandoff(processIdentity);
            } catch (handoffError) {
                log.error("Could not hand off SteamVR restoration after owned process monitoring failed", handoffError);
                throw new SteamLaunchFailure(new AggregateError(
                    [error, handoffError],
                    "Owned Beat Saber exit monitoring failed and SteamVR restore watcher handoff failed"
                ), false);
            }
            throw new SteamLaunchFailure(error, false);
        } finally {
            cleanup();
        }
    }

    private async launchBeatSaberNormally(options: LaunchBeatSaberOptions): Promise<SteamLaunchCompletion> {
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
            if(isFpfc && !isOculus){
                const backupPermError = await this.backupSteamVR()
                    .catch(async () => this.restoreSteamVR().then(() => false));
                if(backupPermError){
                    obs.next({type: BSLaunchWarning.FPFC_NEED_ADMIN});
                }
            } else if(!isFpfc) {
                await this.restoreSteamVR().catch(log.error);
            }

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
                const completion = await launchPromise;
                log.info("BS process exit code", completion.exitCode);
                if (completion.steamVrRestoreSafe) {
                    await this.restoreSteamVR().catch(log.error);
                } else {
                    log.warn("Skipping in-process SteamVR restoration because Beat Saber ownership was not safely completed");
                }
            }
            catch(err: any) {
                if (err instanceof SteamLaunchFailure && err.steamVrRestoreSafe) {
                    await this.restoreSteamVR().catch(log.error);
                }
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
