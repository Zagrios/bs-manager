import { LaunchOption } from "shared/models/bs-launch";
import { BSLocalVersionService } from "../bs-local-version.service";
import { ChildProcess, SpawnOptions } from "node:child_process";
import path from "node:path";
import log from "electron-log";
import { LinuxService } from "../linux.service";
import { BsmShellLog, bsmSpawn, BSM_LAUNCH_TOKEN_ENV, getProcessesByName, ProcessDetails } from "main/helpers/os.helpers";
import { BS_EXECUTABLE, IS_FLATPAK } from "main/constants";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { app } from "electron";
import { StaticConfigurationService } from "main/services/static-configuration.service";
import { abortableDelay } from "main/helpers/abortable-delay.helper";
import { randomUUID } from "node:crypto";

const PROCESS_LIST_RETRY_ATTEMPTS = 3;
const PROCESS_LIST_RETRY_INTERVAL_MS = 100;
const PROCESS_ENUMERATION_TIMEOUT_MS = 5_000;
const OWNED_PROCESS_ACQUISITION_TIMEOUT_MS = 60_000;
const OWNED_PROCESS_FIND_INTERVAL_MS = 250;
const OWNED_PROCESS_EXIT_POLL_INTERVAL_MS = 1_000;

export type ProcessOwnershipSnapshot = {
    existingProcessIds: Set<number>;
    launchedAfter: Date;
    launchToken?: string;
};

export type OwnedProcessIdentity = {
    pid: number;
    startedAt: Date;
    startMarker?: string;
};

export type LaunchedBeatSaber = {
    process: ChildProcess;
    exit: Promise<number>;
    ownership: Promise<OwnedProcessIdentity | undefined>;
    signal: AbortSignal;
};

export function buildBsLaunchArgs(launchOptions: LaunchOption): string[] {
    const launchArgs = [];

    if(!launchOptions.version.steam && !launchOptions.version.oculus){
        launchArgs.push("--no-yeet")
    }
    if(launchOptions.launchMods?.includes(LaunchMods.OCULUS)) {
        launchArgs.push("-vrmode");
        launchArgs.push("oculus");
    }
    if(launchOptions.launchMods?.includes(LaunchMods.FPFC)) {
        launchArgs.push("fpfc");
    }
    if(launchOptions.launchMods?.includes(LaunchMods.DEBUG)) {
        launchArgs.push("--verbose");
    }
    if(launchOptions.launchMods?.includes(LaunchMods.EDITOR)) {
        launchArgs.push("editor");
    }

    return Array.from(new Set(launchArgs).values());
}

export abstract class AbstractLauncherService {

    protected readonly linux = LinuxService.getInstance();
    protected readonly localVersions = BSLocalVersionService.getInstance();
    protected readonly staticConfig = StaticConfigurationService.getInstance();

    constructor(){
        this.linux = LinuxService.getInstance();
        this.localVersions = BSLocalVersionService.getInstance();
    }

    protected launchBeatSaberProcess(options: LaunchBeatSaberOptions): ChildProcess {
        const launchEnvironment = {
            ...options.customEnv,
            ...options.env,
            ...(options.ownershipToken ? { [BSM_LAUNCH_TOKEN_ENV]: options.ownershipToken } : {}),
        };
        const spawnOptions: SpawnOptions = {
            detached: true,
            cwd: options.beatSaberFolderPath,
            env: launchEnvironment,
            stdio: "ignore",
        };

        if (options.args?.includes("--verbose")){
            spawnOptions.windowsVerbatimArguments = true;
        }

        spawnOptions.shell = true; // For windows to spawn properly
        return bsmSpawn(options.cmdlet, {
            args: options.args, options: spawnOptions, log: BsmShellLog.Command,
            flatpak: {
                host: IS_FLATPAK,
                env: [
                    "SteamAppId",
                    "SteamOverlayGameId",
                    "SteamGameId",
                    "WINEDLLOVERRIDES",
                    "STEAM_COMPAT_DATA_PATH",
                    "STEAM_COMPAT_INSTALL_PATH",
                    "STEAM_COMPAT_CLIENT_INSTALL_PATH",
                    "STEAM_COMPAT_APP_ID",
                    "SteamEnv",
                    "OXR_PARALLEL_VIEWS",
                    "PROTON_LOG",
                    "PROTON_LOG_DIR",
                    BSM_LAUNCH_TOKEN_ENV,
                    ...Object.keys(options.customEnv || {})
                ],
            },
        });
    }

    protected waitForProcessList(
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
            processes.then(processDetails => {
                if (signal?.aborted) {
                    settle(new Error("Process ownership acquisition was cancelled"));
                } else if (Date.now() >= deadline) {
                    settle(new Error("Process enumeration timed out"));
                } else {
                    settle(undefined, processDetails);
                }
            }, settle);
        });
    }

    private assertProcessOwnershipAcquisitionIsActive(signal?: AbortSignal): void {
        if (signal?.aborted) {
            throw new Error("Process ownership acquisition was cancelled");
        }
    }

    private assertProcessEnumerationIsWithinDeadline(
        enumerationStartedAt: number,
        retryDeadline: number,
        lastError?: unknown
    ): void {
        if (enumerationStartedAt >= retryDeadline) {
            throw lastError ?? new Error("Process enumeration timed out");
        }
    }

    private async waitBeforeProcessListRetry(
        error: unknown,
        attempt: number,
        retryDeadline: number,
        signal?: AbortSignal
    ): Promise<void> {
        if (signal?.aborted) {
            throw error;
        }

        const remainingMs = retryDeadline - Date.now();
        if (attempt + 1 >= PROCESS_LIST_RETRY_ATTEMPTS || remainingMs <= 0) {
            return;
        }

        const retryDelayCompleted = await abortableDelay(
            Math.min(PROCESS_LIST_RETRY_INTERVAL_MS, remainingMs),
            signal
        );
        if (!retryDelayCompleted) {
            throw error;
        }
    }

    protected async getProcessesWithRetry(
        name: string,
        signal?: AbortSignal,
        deadline?: number,
        launchToken?: string
    ): Promise<ProcessDetails[]> {
        const retryDeadline = deadline ?? Date.now() + PROCESS_ENUMERATION_TIMEOUT_MS;
        let lastError: unknown;
        for (let attempt = 0; attempt < PROCESS_LIST_RETRY_ATTEMPTS; attempt++) {
            this.assertProcessOwnershipAcquisitionIsActive(signal);
            const enumerationStartedAt = Date.now();
            this.assertProcessEnumerationIsWithinDeadline(enumerationStartedAt, retryDeadline, lastError);
            try {
                const enumerationDeadline = Math.min(
                    retryDeadline,
                    enumerationStartedAt + PROCESS_ENUMERATION_TIMEOUT_MS
                );
                return await this.waitForProcessList(getProcessesByName(name, launchToken), enumerationDeadline, signal);
            } catch (error) {
                lastError = error;
                await this.waitBeforeProcessListRetry(error, attempt, retryDeadline, signal);
            }
        }
        throw lastError ?? new Error("Could not enumerate processes");
    }

    protected getProcessStartedAt(processDetails: ProcessDetails): Date | undefined {
        if (processDetails.startTime === undefined) {
            return undefined;
        }
        const startedAt = processDetails.startTime instanceof Date
            ? processDetails.startTime
            : new Date(processDetails.startTime);
        return Number.isFinite(startedAt.getTime()) ? startedAt : undefined;
    }

    protected processTargetsExecutable(
        processDetails: ProcessDetails,
        executablePath: string,
        launchedAfter: Date,
        allowUnavailablePath = false
    ): boolean {
        const processName = process.platform === "linux"
            ? path.posix.basename((processDetails.name ?? "").replaceAll("\\", "/"))
            : path.win32.basename(processDetails.name ?? "");
        if (!Number.isSafeInteger(processDetails.pid) || processDetails.pid <= 0
            || processName.toLowerCase() !== BS_EXECUTABLE.toLowerCase()) {
            return false;
        }

        const processStartedAt = this.getProcessStartedAt(processDetails);
        if (processStartedAt === undefined || processStartedAt.getTime() < launchedAfter.getTime()) {
            return false;
        }
        if (!processDetails.cmd) {
            return process.platform === "win32" && allowUnavailablePath;
        }

        if (process.platform === "linux") {
            const normalizedExecutablePath = path.posix.normalize(executablePath.replaceAll("\\", "/"));
            const normalizedCommand = processDetails.cmd.replaceAll("\\", "/").trim();
            const possiblePaths = [
                normalizedExecutablePath,
                `Z:${normalizedExecutablePath}`,
                `z:${normalizedExecutablePath}`,
            ];
            return possiblePaths.some(possiblePath => {
                let matchIndex = normalizedCommand.indexOf(possiblePath);
                while (matchIndex >= 0) {
                    const before = normalizedCommand[matchIndex - 1];
                    const after = normalizedCommand[matchIndex + possiblePath.length];
                    const startsAtBoundary = matchIndex === 0 || before === "\"" || /\s/.test(before);
                    const endsAtBoundary = after === undefined || after === "\"" || /\s/.test(after);
                    if (startsAtBoundary && endsAtBoundary) {
                        return true;
                    }
                    matchIndex = normalizedCommand.indexOf(possiblePath, matchIndex + 1);
                }
                return false;
            });
        }

        const normalizedExecutablePath = path.win32.normalize(executablePath).toLowerCase();
        const normalizedCommand = processDetails.cmd.replaceAll("/", "\\").trim().toLowerCase();
        const quotedExecutablePath = `"${normalizedExecutablePath}"`;
        return normalizedCommand === normalizedExecutablePath
            || normalizedCommand.startsWith(`${normalizedExecutablePath} `)
            || normalizedCommand === quotedExecutablePath
            || normalizedCommand.startsWith(`${quotedExecutablePath} `);
    }

    protected selectOwnedProcess(
        processes: ProcessDetails[],
        existingProcessIds: Set<number>,
        executablePath: string,
        launchedAfter: Date,
        launcherProcessId?: number,
        launchToken?: string
    ): ProcessDetails | undefined {
        if (!launchToken && (!Number.isSafeInteger(launcherProcessId) || (launcherProcessId ?? 0) <= 0)) {
            return undefined;
        }

        const candidates = processes.filter(processDetails => !existingProcessIds.has(processDetails.pid)
            && (launchToken
                ? processDetails.launchToken === launchToken
                : (processDetails.ppid === launcherProcessId
                    || (process.platform === "linux"
                        && (processDetails.processGroupId === launcherProcessId
                            || processDetails.ancestorPids?.includes(launcherProcessId)))))
            && this.processTargetsExecutable(processDetails, executablePath, launchedAfter, true));
        return candidates.length === 1 ? candidates[0] : undefined;
    }

    private async waitForNextOwnedProcessAttempt(deadline: number, signal?: AbortSignal): Promise<boolean> {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0 || signal?.aborted) {
            return false;
        }
        return abortableDelay(Math.min(OWNED_PROCESS_FIND_INTERVAL_MS, remainingMs), signal);
    }

    private async waitAfterOwnedProcessEnumerationError(
        error: unknown,
        deadline: number,
        signal?: AbortSignal
    ): Promise<boolean> {
        if (signal?.aborted) {
            return false;
        }
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
            throw error;
        }
        return abortableDelay(Math.min(OWNED_PROCESS_FIND_INTERVAL_MS, remainingMs), signal);
    }

    private toOwnedProcessIdentity(
        ownedProcess: ProcessDetails | undefined,
        deadline: number,
        signal?: AbortSignal
    ): OwnedProcessIdentity | undefined {
        const startedAt = ownedProcess && this.getProcessStartedAt(ownedProcess);
        if (!ownedProcess || !startedAt || signal?.aborted || Date.now() >= deadline) {
            return undefined;
        }
        return {
            pid: ownedProcess.pid,
            startedAt,
            ...(ownedProcess.startMarker ? { startMarker: ownedProcess.startMarker } : {}),
        };
    }

    protected async findOwnedProcess(
        existingProcessIds: Set<number>,
        executablePath: string,
        launchedAfter: Date,
        launcherProcessId?: number,
        signal?: AbortSignal,
        launchToken?: string
    ): Promise<OwnedProcessIdentity | undefined> {
        if (!launchToken && (!Number.isSafeInteger(launcherProcessId) || (launcherProcessId ?? 0) <= 0)) {
            return undefined;
        }

        const deadline = Date.now() + OWNED_PROCESS_ACQUISITION_TIMEOUT_MS;
        do {
            let processes: ProcessDetails[];
            try {
                processes = await this.getProcessesWithRetry(BS_EXECUTABLE, signal, deadline, launchToken);
            } catch (error) {
                if (!(await this.waitAfterOwnedProcessEnumerationError(error, deadline, signal))) {
                    return undefined;
                }
                continue;
            }
            const ownedProcess = this.selectOwnedProcess(
                processes,
                existingProcessIds,
                executablePath,
                launchedAfter,
                launcherProcessId,
                launchToken
            );
            const ownedProcessIdentity = this.toOwnedProcessIdentity(ownedProcess, deadline, signal);
            if (ownedProcessIdentity) {
                return ownedProcessIdentity;
            }

            if (!(await this.waitForNextOwnedProcessAttempt(deadline, signal))) {
                return undefined;
            }
        } while (Date.now() < deadline);

        return undefined;
    }

    protected processMatchesOwnedIdentity(
        processDetails: ProcessDetails,
        executablePath: string,
        ownedProcess: OwnedProcessIdentity
    ): boolean {
        return processDetails.pid === ownedProcess.pid
            && this.processTargetsExecutable(processDetails, executablePath, ownedProcess.startedAt, true)
            && this.getProcessStartedAt(processDetails)?.getTime() === ownedProcess.startedAt.getTime()
            && (ownedProcess.startMarker === undefined
                || processDetails.startMarker === ownedProcess.startMarker);
    }

    protected async waitForOwnedProcessExit(
        executablePath: string,
        ownedProcess: OwnedProcessIdentity,
        signal?: AbortSignal
    ): Promise<boolean> {
        while (!signal?.aborted) {
            const processes = await this.getProcessesWithRetry(BS_EXECUTABLE, signal);
            if (!processes.some(processDetails => this.processMatchesOwnedIdentity(
                processDetails,
                executablePath,
                ownedProcess
            ))) {
                return true;
            }
            if (!(await abortableDelay(OWNED_PROCESS_EXIT_POLL_INTERVAL_MS, signal))) {
                return false;
            }
        }
        return false;
    }

    protected async createProcessOwnershipSnapshot(): Promise<ProcessOwnershipSnapshot | undefined> {
        const deadline = Date.now() + PROCESS_ENUMERATION_TIMEOUT_MS;
        try {
            const existingProcesses = await this.getProcessesWithRetry(BS_EXECUTABLE, undefined, deadline);
            return {
                existingProcessIds: new Set(existingProcesses.map(processDetails => processDetails.pid)),
                launchedAfter: process.platform === "linux"
                    ? new Date(Math.floor(Date.now() / 1_000) * 1_000)
                    : new Date(),
                ...(IS_FLATPAK ? { launchToken: randomUUID() } : {}),
            };
        } catch (error) {
            log.warn("Could not snapshot existing Beat Saber processes; continuing without launch ownership", error);
            return undefined;
        }
    }

    protected handleOwnedProcessStarted(ownedProcess: OwnedProcessIdentity, signal?: AbortSignal): void {
        if (!signal?.aborted && this.staticConfig.get("close-bs-manager-on-launch")) {
            log.info(`Safely owned Beat Saber process ${ownedProcess.pid} started; closing BSManager`);
            app.quit();
        }
    }

    protected launchBeatSaber(
        options: LaunchBeatSaberOptions,
        ownershipSnapshot?: ProcessOwnershipSnapshot
    ): LaunchedBeatSaber {
        const process = this.launchBeatSaberProcess({
            ...options,
            ownershipToken: ownershipSnapshot?.launchToken,
        });
        const ownershipLifecycle = new AbortController();
        const executablePath = path.join(options.beatSaberFolderPath, BS_EXECUTABLE);
        const ownership = ownershipSnapshot
            ? this.findOwnedProcess(
                ownershipSnapshot.existingProcessIds,
                executablePath,
                ownershipSnapshot.launchedAfter,
                process.pid,
                ownershipLifecycle.signal,
                ownershipSnapshot.launchToken
            ).catch((error): undefined => {
                if (!ownershipLifecycle.signal.aborted) {
                    log.error("Could not acquire the launched Beat Saber process", error);
                }
                return undefined;
            })
            : Promise.resolve(undefined);

        ownership.then(ownedProcess => {
            if (ownedProcess && !ownershipLifecycle.signal.aborted) {
                this.handleOwnedProcessStarted(ownedProcess, ownershipLifecycle.signal);
            }
        }).catch(error => log.error("Could not handle the launched Beat Saber process", error));

        const exit = new Promise<number>((resolve, reject) => {
            const cleanupQuit = () => app.removeListener("will-quit", onWillQuitHandler);
            const onWillQuitHandler = () => {
                cleanupQuit();
                ownershipLifecycle.abort();
                if (!process.killed) {
                    log.info(`Unref'ing BS process ${process.pid} on app will-quit`);
                    process.unref();
                }
            };

            process.once("error", (err) => {
                log.error("Error while launching BS", err);
                cleanupQuit();
                ownershipLifecycle.abort();
                reject(err);
            });

            process.once("exit", (code) => {
                log.info(`BS process exit with code ${code}`);
                ownership.finally(cleanupQuit);
                resolve(code ?? -1);
            });

            app.on("will-quit", onWillQuitHandler);
        });

        return { process, exit, ownership, signal: ownershipLifecycle.signal };
    }

    /**
     * Updates the env variables between the originalEnv (comming from the BSM)
     *   and customEnv (coming from the user).
     * - originalEnv keys will be overwritten with customEnv values
     * - customEnv keys will be removed if they exist in originalEnv
     */
    protected updateEnvVariables(
        originalEnv: Record<string, string>,
        customEnv: Record<string, string>
    ): void {
        for (const [ key, value ] of Object.entries(customEnv)) {
            const isOverride = key in originalEnv;

            log.info(
                isOverride ? "Overriding" : "Injecting",
                `${key}="${value}"`,
                "to the env launch command"
            );

            if (isOverride) {
                originalEnv[key] = value;
                delete customEnv[key];
            }
        }
    }

}

export type LaunchBeatSaberOptions = {
    // To be passed to the bsmSpawn helper function
    // Can be the Beat Saber exe or wrapper exe (for linux)
    cmdlet: string;
    env: Record<string, string>;
    // Should come from either launch options or custom launch mod.
    customEnv: Record<string, string>;
    beatSaberFolderPath: string;

    args?: string[]; // Appended to the cmdlet string
    ownershipToken?: string;
}
