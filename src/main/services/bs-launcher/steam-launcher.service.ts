import { Observable } from "rxjs";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, BSLaunchWarning, LaunchOption } from "../../../shared/models/bs-launch";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { pathExists, remove, rename } from "fs-extra";
import { SteamService } from "../steam.service";
import path from "path";
import { BS_APP_ID, BS_EXECUTABLE, STEAMVR_APP_ID } from "../../constants";
import log from "electron-log";
import { AbstractLauncherService, buildBsLaunchArgs, LaunchBeatSaberOptions } from "./abstract-launcher.service";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { UtilsService } from "../utils.service";
import { exec, spawn, ChildProcess, ExecOptions } from "child_process";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { app, Event } from "electron";
import { parseLaunchOptions } from "main/helpers/launchOptions.helper";
import { getProcessesByName, ProcessDetails } from "main/helpers/os.helpers";
import { randomUUID } from "crypto";
import { abortableDelay } from "main/helpers/abortable-delay.helper";
import { buildWindowsPowerShellArgs, getWindowsPowerShellPath } from "main/helpers/windows-powershell.helper";

const STEAM_VR_WATCHER_READY_TIMEOUT_MS = 65_000;
const STEAM_VR_WATCHER_READY_POLL_INTERVAL_MS = 50;
const PROCESS_LIST_RETRY_ATTEMPTS = 3;
const PROCESS_LIST_RETRY_INTERVAL_MS = 100;
const OWNED_PROCESS_FIND_TIMEOUT_MS = 5_000;
const OWNED_PROCESS_FIND_INTERVAL_MS = 250;

type ProcessOwnershipSnapshot = {
    existingProcessIds: Set<number>;
    launchedAfter: Date;
};

type OwnedProcessIdentity = {
    pid: number;
    startedAt: Date;
};

const STEAM_VR_RESTORE_WATCHER_SCRIPT = `
$ownedProcess = $null
$findDeadline = [DateTime]::UtcNow.AddSeconds(60)

do {
    if ($TargetProcessId -gt 0) {
        $processCandidates = @(Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue)
    }
    else {
        $processCandidates = @(Get-Process -Name "Beat Saber" -ErrorAction SilentlyContinue)
    }

    $ownedProcess = $processCandidates |
        Where-Object {
            try {
                $processStartedAtUtc = $_.StartTime.ToUniversalTime()
                $startTimeMatches = if ($null -ne $TargetProcessStartedAtUtc) {
                    $processStartedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") -eq
                        $TargetProcessStartedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                }
                else {
                    $processStartedAtUtc -ge $LaunchStartedAfterUtc
                }

                $_.Path -ieq $TargetExecutablePath -and
                    $startTimeMatches
            }
            catch {
                $false
            }
        } |
        Sort-Object StartTime |
        Select-Object -First 1

    if ($null -eq $ownedProcess) {
        Start-Sleep -Milliseconds 500
    }
} while ($null -eq $ownedProcess -and [DateTime]::UtcNow -lt $findDeadline)

if ($null -eq $ownedProcess) {
    exit 2
}

$ownedProcessId = $ownedProcess.Id
$ownedProcessStartedAtUtc = $ownedProcess.StartTime.ToUniversalTime()
try {
    [System.IO.File]::WriteAllText($HandoffReadyPath, "$ownedProcessId")
}
catch {
    exit 4
}

while ($true) {
    $currentProcess = Get-Process -Id $ownedProcessId -ErrorAction SilentlyContinue
    if ($null -eq $currentProcess) {
        break
    }
    try {
        if ($currentProcess.Path -ine $TargetExecutablePath -or
            $currentProcess.StartTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") -ne
                $ownedProcessStartedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")) {
            break
        }
    }
    catch {
        break
    }
    Start-Sleep -Seconds 1
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
        return path.join(this.util.getAssetsScriptsPath(), "start_beat_saber_admin.exe");
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

    private async waitForSteamVRWatcherReady(watcher: ChildProcess, readyPath: string): Promise<void> {
        const deadline = Date.now() + STEAM_VR_WATCHER_READY_TIMEOUT_MS;

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
                        if (await pathExists(readyPath)) {
                            settle();
                            return;
                        }
                        if (terminalError) {
                            settle(terminalError);
                            return;
                        }
                        const remainingMs = deadline - Date.now();
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
                const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
                    failBeforeReady(new Error(`SteamVR restore watcher exited before readiness (code ${code ?? "null"}, signal ${signal ?? "none"})`));
                };

                watcher.once("error", onError);
                watcher.once("exit", onExit);
                pollReady();
            });
        } finally {
            await remove(readyPath).catch(error => log.warn("Could not remove SteamVR watcher readiness file", error));
        }
    }

    private waitForProcessList(
        processes: Promise<ProcessDetails[]>,
        deadline: number,
        signal?: AbortSignal
    ): Promise<ProcessDetails[]> {
        return new Promise((resolve, reject) => {
            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0) {
                reject(new Error("Process enumeration timed out"));
                return;
            }
            if (signal?.aborted) {
                reject(new Error("Process ownership acquisition was cancelled"));
                return;
            }

            let settled = false;
            const cleanup = () => {
                clearTimeout(timer);
                signal?.removeEventListener("abort", onAbort);
            };
            const settle = (error?: unknown, processDetails?: ProcessDetails[]) => {
                if (settled) { return; }
                settled = true;
                cleanup();
                if (error) {
                    reject(error);
                } else {
                    resolve(processDetails ?? []);
                }
            };
            const onAbort = () => settle(new Error("Process ownership acquisition was cancelled"));
            const timer = setTimeout(() => settle(new Error("Process enumeration timed out")), remainingMs);
            signal?.addEventListener("abort", onAbort, { once: true });
            processes.then(processDetails => settle(undefined, processDetails), settle);
        });
    }

    private async getProcessesWithRetry(
        name: string,
        signal?: AbortSignal,
        deadline = Date.now() + OWNED_PROCESS_FIND_TIMEOUT_MS
    ): Promise<ProcessDetails[]> {
        let lastError: unknown;
        for (let attempt = 0; attempt < PROCESS_LIST_RETRY_ATTEMPTS; attempt++) {
            if (signal?.aborted) {
                throw new Error("Process ownership acquisition was cancelled");
            }
            try {
                return await this.waitForProcessList(getProcessesByName(name), deadline, signal);
            } catch (error) {
                lastError = error;
                if (signal?.aborted) {
                    throw error;
                }
                const remainingMs = deadline - Date.now();
                if (attempt + 1 < PROCESS_LIST_RETRY_ATTEMPTS && remainingMs > 0) {
                    const retryDelayCompleted = await abortableDelay(
                        Math.min(PROCESS_LIST_RETRY_INTERVAL_MS, remainingMs),
                        signal
                    );
                    if (!retryDelayCompleted) {
                        throw error;
                    }
                }
            }
        }
        throw lastError ?? new Error("Could not enumerate processes");
    }

    private getProcessStartedAt(processDetails: ProcessDetails): Date | undefined {
        if (processDetails.startTime === undefined) {
            return undefined;
        }
        const startedAt = processDetails.startTime instanceof Date
            ? processDetails.startTime
            : new Date(processDetails.startTime);
        return Number.isFinite(startedAt.getTime()) ? startedAt : undefined;
    }

    private processTargetsExecutable(processDetails: ProcessDetails, executablePath: string, launchedAfter: Date): boolean {
        if (!Number.isSafeInteger(processDetails.pid) || processDetails.pid <= 0
            || path.win32.basename(processDetails.name ?? "").toLowerCase() !== BS_EXECUTABLE.toLowerCase()
            || !processDetails.cmd) {
            return false;
        }

        const normalizedExecutablePath = path.win32.normalize(executablePath).toLowerCase();
        const normalizedCommand = processDetails.cmd.replaceAll("/", "\\").trim().toLowerCase();
        const quotedExecutablePath = `"${normalizedExecutablePath}"`;
        const exactCommandPath = normalizedCommand === normalizedExecutablePath
            || normalizedCommand.startsWith(`${normalizedExecutablePath} `)
            || normalizedCommand === quotedExecutablePath
            || normalizedCommand.startsWith(`${quotedExecutablePath} `);
        if (!exactCommandPath) {
            return false;
        }

        const processStartedAt = this.getProcessStartedAt(processDetails);
        return processStartedAt !== undefined && processStartedAt.getTime() >= launchedAfter.getTime();
    }

    private selectOwnedProcess(
        processes: ProcessDetails[],
        existingProcessIds: Set<number>,
        executablePath: string,
        launchedAfter: Date,
        launcherProcessId?: number
    ): ProcessDetails | undefined {
        const candidates = processes.filter(processDetails => !existingProcessIds.has(processDetails.pid)
            && this.processTargetsExecutable(processDetails, executablePath, launchedAfter));
        if (candidates.length <= 1) {
            return candidates[0];
        }

        const launcherChildren = candidates.filter(processDetails => processDetails.ppid === launcherProcessId);
        return Number.isSafeInteger(launcherProcessId) && launcherProcessId > 0 && launcherChildren.length === 1
            ? launcherChildren[0]
            : undefined;
    }

    private async findOwnedProcess(
        existingProcessIds: Set<number>,
        executablePath: string,
        launchedAfter: Date,
        launcherProcessId?: number,
        signal?: AbortSignal
    ): Promise<OwnedProcessIdentity | undefined> {
        const deadline = Date.now() + OWNED_PROCESS_FIND_TIMEOUT_MS;
        do {
            let processes: ProcessDetails[];
            try {
                processes = await this.getProcessesWithRetry(BS_EXECUTABLE, signal, deadline);
            } catch (error) {
                if (signal?.aborted) {
                    return undefined;
                }
                throw error;
            }
            const ownedProcess = this.selectOwnedProcess(
                processes,
                existingProcessIds,
                executablePath,
                launchedAfter,
                launcherProcessId
            );
            const startedAt = ownedProcess && this.getProcessStartedAt(ownedProcess);
            if (ownedProcess && startedAt) {
                return { pid: ownedProcess.pid, startedAt };
            }

            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0 || signal?.aborted) {
                return undefined;
            }
            if (!(await abortableDelay(Math.min(OWNED_PROCESS_FIND_INTERVAL_MS, remainingMs), signal))) {
                return undefined;
            }
        } while (Date.now() < deadline);

        return undefined;
    }

    private processMatchesOwnedIdentity(
        processDetails: ProcessDetails,
        executablePath: string,
        ownedProcess: OwnedProcessIdentity
    ): boolean {
        return processDetails.pid === ownedProcess.pid
            && this.processTargetsExecutable(processDetails, executablePath, ownedProcess.startedAt)
            && this.getProcessStartedAt(processDetails)?.getTime() === ownedProcess.startedAt.getTime();
    }

    private async createProcessOwnershipSnapshot(): Promise<ProcessOwnershipSnapshot> {
        const deadline = Date.now() + OWNED_PROCESS_FIND_TIMEOUT_MS;
        const existingProcesses = await this.getProcessesWithRetry(BS_EXECUTABLE, undefined, deadline);
        return {
            existingProcessIds: new Set(existingProcesses.map(processDetails => processDetails.pid)),
            launchedAfter: new Date(),
        };
    }

    private async handoffSteamVRRestore(
        bsExePath: string,
        launchedAfter: Date,
        ownedProcessId?: number,
        ownedProcessStartedAt?: Date
    ): Promise<void> {
        const steamVrFolder = await this.getSteamVRPath();
        if (!steamVrFolder) { return; }
        const steamVrBackup = `${steamVrFolder}.bak`;
        if (!(await pathExists(steamVrBackup))) { return; }
        const readyPath = path.join(app.getPath("temp"), `bsmanager-steamvr-restore-${randomUUID()}.ready`);

        const encode = (value: string) => Buffer.from(value, "utf8").toString("base64");
        const script = `$TargetExecutablePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(bsExePath)}'))
$SteamVrFolderPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(steamVrFolder)}'))
$SteamVrBackupPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(steamVrBackup)}'))
$HandoffReadyPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(readyPath)}'))
$TargetProcessId = ${ownedProcessId ?? 0}
$TargetProcessStartedAtUtc = ${ownedProcessStartedAt ? `[DateTime]::Parse('${ownedProcessStartedAt.toISOString()}').ToUniversalTime()` : "$null"}
$LaunchStartedAfterUtc = [DateTime]::Parse('${launchedAfter.toISOString()}').ToUniversalTime()
${STEAM_VR_RESTORE_WATCHER_SCRIPT}`;
        const watcher = spawn(getWindowsPowerShellPath(), buildWindowsPowerShellArgs(script), {
            detached: true,
            shell: false,
            stdio: "ignore",
            windowsHide: true,
        });
        await this.waitForSteamVRWatcherReady(watcher, readyPath);
        watcher.once("error", error => log.error("SteamVR restore watcher error", error));
        watcher.once("exit", code => {
            if (code !== 0) {
                log.error(`SteamVR restore watcher exited with code ${code}`);
            }
        });
        watcher.unref();
    }

    private async launchBeatSaberAsAdmin(bsExePath: string, launchArgs: string[], options: ExecOptions): Promise<number> {
        const { existingProcessIds, launchedAfter } = await this.createProcessOwnershipSnapshot();
        let restoreHandedOff = false;
        let helperProcessId: number | undefined;
        let adminProcess: ChildProcess;
        const helperExitCode = await new Promise<number>((resolve, reject) => {
            adminProcess = exec(`"${this.getStartBsAsAdminExePath()}" "${bsExePath}" ${launchArgs.join(" ")} --log-path "${path.join(app.getPath("logs"), "bs-admin-start.log")}"`, options);
            helperProcessId = adminProcess.pid;

            let handoffPending = false;
            let settleHelperAfterHandoff: (() => void) | undefined;
            const cleanup = () => app.removeListener("will-quit", onWillQuitHandler);
            const onWillQuitHandler = async (event: Event) => {
                if (!adminProcess.killed) {
                    event.preventDefault();
                    if (handoffPending) { return; }
                    handoffPending = true;
                    log.info(`Unref'ing admin launcher process ${adminProcess.pid} on app will-quit`);
                    try {
                        await this.handoffSteamVRRestore(bsExePath, launchedAfter);
                    } catch (error) {
                        handoffPending = false;
                        log.error("Could not hand off SteamVR restoration", error);
                        settleHelperAfterHandoff?.();
                        settleHelperAfterHandoff = undefined;
                        return;
                    }
                    restoreHandedOff = true;
                    settleHelperAfterHandoff = undefined;
                    cleanup();
                    adminProcess.unref();
                    app.quit();
                } else {
                    cleanup();
                }
            };

            adminProcess.once("error", err => {
                log.error("Error while starting BS as Admin", err);
                const settle = () => {
                    cleanup();
                    reject(err);
                };
                if (handoffPending) {
                    settleHelperAfterHandoff ??= settle;
                } else if (!restoreHandedOff) {
                    settle();
                }
            });
            adminProcess.once("exit", code => {
                const settle = () => {
                    cleanup();
                    resolve(code ?? -1);
                };
                if (handoffPending) {
                    settleHelperAfterHandoff ??= settle;
                } else if (!restoreHandedOff) {
                    settle();
                }
            });
            app.on("will-quit", onWillQuitHandler);
        });

        if (helperExitCode !== 0) {
            return helperExitCode;
        }
        const ownedProcess = await this.findOwnedProcess(
            existingProcessIds,
            bsExePath,
            launchedAfter,
            helperProcessId
        );
        if (!ownedProcess) {
            return helperExitCode;
        }
        const ownedProcessLifecycle = new AbortController();
        this.handleGameWindowReady(
            adminProcess,
            path.dirname(bsExePath),
            launchedAfter,
            ownedProcess.pid,
            ownedProcessLifecycle.signal,
            ownedProcess.startedAt
        );

        return new Promise<number>((resolve, reject) => {
            let pollTimer: NodeJS.Timeout;
            let handoffPending = false;
            const cleanup = () => {
                clearTimeout(pollTimer);
                app.removeListener("will-quit", onWillQuitHandler);
                ownedProcessLifecycle.abort();
            };
            const onWillQuitHandler = async (event: Event) => {
                event.preventDefault();
                if (handoffPending) { return; }
                handoffPending = true;
                try {
                    await this.handoffSteamVRRestore(
                        bsExePath,
                        launchedAfter,
                        ownedProcess.pid,
                        ownedProcess.startedAt
                    );
                } catch (error) {
                    handoffPending = false;
                    log.error("Could not hand off SteamVR restoration", error);
                    return;
                }
                cleanup();
                app.quit();
            };
            const pollBeatSaber = () => {
                this.getProcessesWithRetry(BS_EXECUTABLE).then(processes => {
                    const ownedProcessIsRunning = processes.some(processDetails => this.processMatchesOwnedIdentity(
                        processDetails,
                        bsExePath,
                        ownedProcess
                    ));
                    if (ownedProcessIsRunning) {
                        pollTimer = setTimeout(pollBeatSaber, 1_000);
                    } else {
                        cleanup();
                        resolve(0);
                    }
                }).catch(error => {
                    cleanup();
                    reject(error);
                });
            };

            app.on("will-quit", onWillQuitHandler);
            pollBeatSaber();
        });
    }

    protected launchBeatSaber(
        options: LaunchBeatSaberOptions,
        ownershipSnapshot?: ProcessOwnershipSnapshot
    ): {process: ChildProcess, exit: Promise<number>} {
        const launchedAfter = ownershipSnapshot?.launchedAfter ?? new Date();
        const process = this.launchBeatSaberProcess(options);
        const ownershipLifecycle = new AbortController();
        const executablePath = path.join(options.beatSaberFolderPath, BS_EXECUTABLE);
        const ownedProcess: Promise<OwnedProcessIdentity | undefined> = ownershipSnapshot
            ? this.findOwnedProcess(
                ownershipSnapshot.existingProcessIds,
                executablePath,
                launchedAfter,
                process.pid,
                ownershipLifecycle.signal
            ).catch((error): undefined => {
                if (!ownershipLifecycle.signal.aborted) {
                    log.error("Could not acquire the launched Beat Saber process", error);
                }
                return undefined;
            })
            : Promise.resolve(undefined);
        ownedProcess.then(processIdentity => {
            if (processIdentity && !ownershipLifecycle.signal.aborted) {
                this.handleGameWindowReady(
                    process,
                    options.beatSaberFolderPath,
                    launchedAfter,
                    processIdentity.pid,
                    ownershipLifecycle.signal,
                    processIdentity.startedAt
                );
            }
        }).catch(error => log.error("Could not start Beat Saber window handling", error));

        const exit = new Promise<number>((resolve, reject) => {
            // Don't remove, useful for debugging!
            // process.stdout.on("data", (data) => {
            //    log.info(`BS stdout: ${data}`);
            // });
            // process.stderr.on("data", (data) => {
            //    log.error(`BS stderr: ${data}`);
            // });

            let handoffPending = false;
            const cleanup = () => {
                ownershipLifecycle.abort();
                app.removeListener('will-quit', onWillQuitHandler);
            };
            const onWillQuitHandler = async (event: Event) => {
                if (!process.killed) {
                    event.preventDefault();
                    if (handoffPending) { return; }
                    handoffPending = true;
                    const processIdentity = await ownedProcess;
                    if (!processIdentity || ownershipLifecycle.signal.aborted) {
                        handoffPending = false;
                        return;
                    }
                    log.info(`Unref'ing BS process ${processIdentity.pid} on app will-quit`);
                    try {
                        await this.handoffSteamVRRestore(
                            executablePath,
                            launchedAfter,
                            processIdentity.pid,
                            processIdentity.startedAt
                        );
                    } catch (error) {
                        handoffPending = false;
                        log.error("Could not hand off SteamVR restoration", error);
                        return;
                    }
                    cleanup();
                    process.unref();
                    app.quit();
                } else {
                    cleanup();
                }
            };

            process.once("error", (err) => {
                log.error(`Error while launching BS`, err);
                cleanup();
                reject(err);
            });

            process.once("exit", (code) => {
                log.info(`BS process exit with code ${code}`);
                cleanup();
                resolve(code);
            });

            app.on('will-quit', onWillQuitHandler);
        });

        return { process, exit };
    }

    private async launchBeatSaberNormally(options: LaunchBeatSaberOptions): Promise<number> {
        if (process.platform !== "win32") {
            return this.launchBeatSaber(options).exit;
        }
        const ownershipSnapshot = await this.createProcessOwnershipSnapshot();
        return this.launchBeatSaber(options, ownershipSnapshot).exit;
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
                const exitCode = await launchPromise;
                log.info("BS process exit code", exitCode);
            }
            catch(err: any) {
                throw CustomError.fromError(err, BSLaunchError.BS_EXIT_ERROR);
            }
            finally {
                await this.restoreSteamVR().catch(log.error);
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
