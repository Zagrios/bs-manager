import path from "node:path";
import { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import log from "electron-log";
import { app } from "electron";
import { IS_FLATPAK } from "main/constants";
import { defaultProcessTable, ProcessInfo, ProcessTable } from "main/helpers/process-table";

const PROCESS_LIST_RETRY_ATTEMPTS = 3;
const PROCESS_LIST_RETRY_INTERVAL_MS = 100;
const PROCESS_ENUMERATION_TIMEOUT_MS = 5_000;
const OWNED_PROCESS_ACQUISITION_TIMEOUT_MS = 60_000;
const OWNED_PROCESS_FIND_INTERVAL_MS = 250;
const OWNED_PROCESS_EXIT_POLL_INTERVAL_MS = 1_000;

export type Timers = {
    now(): number;
    setTimeout(callback: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
};

export type AppLifecycle = {
    onWillQuit(listener: () => void): () => void;
    quit(): void;
};

export type OwnedProcessSessionPorts = {
    processes: ProcessTable;
    timers: Timers;
    lifecycle: AppLifecycle;
    platform: NodeJS.Platform;
    flatpak: boolean;
    newLaunchToken(): string;
};

export type OwnedProcessIdentity = {
    pid: number;
    startedAt: Date;
    startMarker?: string;
};

export type SpawnedLauncher = {
    process: ChildProcess;
    launcherPid?: Promise<number>;
};

export type OwnedProcessLaunch = {
    executablePath: string;
    spawn(launch: { launchToken?: string; signal: AbortSignal }): SpawnedLauncher;
    onStarted?(owned: OwnedProcessIdentity): void;
    onAcquisitionFailure?: "reject" | "untracked";
};

export type OwnedProcessSession = {
    started: Promise<OwnedProcessIdentity | undefined>;
    exit: Promise<number>;
};

export class ProcessTrackingError extends Error {
    public readonly cause: unknown;

    constructor(cause: unknown) {
        super(cause instanceof Error ? cause.message : String(cause));
        this.name = "ProcessTrackingError";
        this.cause = cause;
        if (cause instanceof Error) {
            this.stack = cause.stack;
        }
    }
}

export const systemTimers: Timers = {
    now: () => Date.now(),
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: handle => clearTimeout(handle as NodeJS.Timeout),
};

export const electronAppLifecycle: AppLifecycle = {
    onWillQuit(listener) {
        app.on("will-quit", listener);
        return () => app.removeListener("will-quit", listener);
    },
    quit: () => app.quit(),
};

export function defaultOwnedProcessSessionPorts(): OwnedProcessSessionPorts {
    return {
        processes: defaultProcessTable(),
        timers: systemTimers,
        lifecycle: electronAppLifecycle,
        platform: process.platform,
        flatpak: IS_FLATPAK,
        newLaunchToken: randomUUID,
    };
}

type Snapshot = {
    existingProcessIds: Set<number>;
    launchedAfter: Date;
    launchToken?: string;
};

type OwnershipSearch = {
    snapshot: Snapshot;
    executablePath: string;
    launcherPid?: number;
    signal: AbortSignal;
};

export async function launchOwnedProcess(
    launch: OwnedProcessLaunch,
    ports: OwnedProcessSessionPorts
): Promise<OwnedProcessSession> {
    const { executablePath } = launch;
    const snapshot = await createSnapshot(executablePath, ports);
    const lifecycle = new AbortController();
    const { signal } = lifecycle;
    const { process: launcher, launcherPid } = launch.spawn({ launchToken: snapshot?.launchToken, signal });

    const detachLauncher = () => {
        launcher.stdout?.destroy();
        if (!launcher.killed) {
            launcher.unref();
        }
    };
    let ended = false;
    const endSession = () => {
        if (ended) { return; }
        ended = true;
        lifecycle.abort();
        removeWillQuit();
    };
    const removeWillQuit = ports.lifecycle.onWillQuit(() => {
        endSession();
        log.info(`Unref'ing BS launcher process ${launcher.pid} on app will-quit`);
        detachLauncher();
    });

    const launcherExit = new Promise<number>((resolve, reject) => {
        let settled = false;
        launcher.once("error", error => {
            if (settled) { return; }
            settled = true;
            log.error("Error while launching BS", error);
            lifecycle.abort();
            reject(error);
        });
        launcher.once("exit", code => {
            if (settled) { return; }
            settled = true;
            log.info(`BS launcher process exit with code ${code}`);
            resolve(code ?? -1);
        });
    });
    const launcherOutcome = launcherExit.then(
        exitCode => ({ exitCode }),
        (error: unknown) => ({ error })
    );

    const pid = launcherPid ?? Promise.resolve(launcher.pid);
    const ownership = pid.then(async resolvedPid => {
        if (!snapshot) { return undefined; }
        const search = findOwnedProcess({ snapshot, executablePath, launcherPid: resolvedPid, signal }, ports);
        if (launch.onAcquisitionFailure !== "untracked") {
            return search.catch(error => { throw new ProcessTrackingError(error); });
        }
        return search.catch((error): undefined => {
            if (!signal.aborted) {
                log.error("Could not acquire the launched Beat Saber process", error);
            }
            return undefined;
        });
    });

    ownership.then(owned => {
        if (owned && !signal.aborted) {
            launch.onStarted?.(owned);
        }
    }).catch(error => log.error("Could not handle the launched Beat Saber process", error));

    const exit = (async () => {
        try {
            try {
                await pid;
            } catch (error) {
                detachLauncher();
                throw error;
            }

            const owned = await ownership;
            if (!owned) {
                const outcome = await launcherOutcome;
                if ("error" in outcome) {
                    throw outcome.error;
                }
                return outcome.exitCode;
            }

            try {
                await waitForOwnedProcessExit(executablePath, owned, signal, ports);
            } catch (error) {
                throw new ProcessTrackingError(error);
            }
            return 0;
        } finally {
            endSession();
        }
    })();

    return {
        started: ownership.catch((): undefined => undefined),
        exit,
    };
}

function processNameOf(executablePath: string, platform: NodeJS.Platform): string {
    return platform === "linux"
        ? path.posix.basename(executablePath.replaceAll("\\", "/"))
        : path.win32.basename(executablePath);
}

function delay(timers: Timers, ms: number, signal?: AbortSignal): Promise<boolean> {
    return new Promise(resolve => {
        if (signal?.aborted) {
            resolve(false);
            return;
        }

        let settled = false;
        const finish = (completed: boolean) => {
            if (settled) { return; }
            settled = true;
            timers.clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            resolve(completed);
        };
        const onAbort = () => finish(false);
        const timer = timers.setTimeout(() => finish(true), ms);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

function waitForProcessList(
    processes: Promise<ProcessInfo[]>,
    deadline: number,
    timers: Timers,
    signal?: AbortSignal
): Promise<ProcessInfo[]> {
    return new Promise((resolve, reject) => {
        const remainingMs = deadline - timers.now();
        if (remainingMs <= 0) {
            reject(new Error("Process enumeration timed out"));
            return;
        }
        if (signal?.aborted) {
            reject(new Error("Process ownership acquisition was cancelled"));
            return;
        }

        let settled = false;
        const settle = (error?: unknown, processDetails?: ProcessInfo[]) => {
            if (settled) { return; }
            settled = true;
            timers.clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            if (error) {
                reject(error);
            } else {
                resolve(processDetails ?? []);
            }
        };
        const onAbort = () => settle(new Error("Process ownership acquisition was cancelled"));
        const timer = timers.setTimeout(() => settle(new Error("Process enumeration timed out")), remainingMs);
        signal?.addEventListener("abort", onAbort, { once: true });
        processes.then(processDetails => {
            if (signal?.aborted) {
                settle(new Error("Process ownership acquisition was cancelled"));
            } else if (timers.now() >= deadline) {
                settle(new Error("Process enumeration timed out"));
            } else {
                settle(undefined, processDetails);
            }
        }, settle);
    });
}

async function listGameProcesses(
    executablePath: string,
    ports: OwnedProcessSessionPorts,
    options: { signal?: AbortSignal; deadline?: number; launchToken?: string } = {}
): Promise<ProcessInfo[]> {
    const { timers } = ports;
    const { signal, launchToken } = options;
    const name = processNameOf(executablePath, ports.platform);
    const retryDeadline = options.deadline ?? timers.now() + PROCESS_ENUMERATION_TIMEOUT_MS;
    let lastError: unknown;
    for (let attempt = 0; attempt < PROCESS_LIST_RETRY_ATTEMPTS; attempt++) {
        if (signal?.aborted) {
            throw new Error("Process ownership acquisition was cancelled");
        }
        const enumerationStartedAt = timers.now();
        if (enumerationStartedAt >= retryDeadline) {
            throw lastError ?? new Error("Process enumeration timed out");
        }
        try {
            const enumerationDeadline = Math.min(retryDeadline, enumerationStartedAt + PROCESS_ENUMERATION_TIMEOUT_MS);
            const processes = ports.processes.list(launchToken ? { name, launchToken } : { name });
            return await waitForProcessList(processes, enumerationDeadline, timers, signal);
        } catch (error) {
            lastError = error;
            if (signal?.aborted) {
                throw error;
            }
            const remainingMs = retryDeadline - timers.now();
            if (attempt + 1 < PROCESS_LIST_RETRY_ATTEMPTS && remainingMs > 0
                && !(await delay(timers, Math.min(PROCESS_LIST_RETRY_INTERVAL_MS, remainingMs), signal))) {
                throw error;
            }
        }
    }
    throw lastError ?? new Error("Could not enumerate processes");
}

async function createSnapshot(executablePath: string, ports: OwnedProcessSessionPorts): Promise<Snapshot | undefined> {
    const { timers } = ports;
    try {
        const existingProcesses = await listGameProcesses(executablePath, ports, {
            deadline: timers.now() + PROCESS_ENUMERATION_TIMEOUT_MS,
        });
        return {
            existingProcessIds: new Set(existingProcesses.map(processDetails => processDetails.pid)),
            launchedAfter: ports.platform === "linux"
                ? new Date(Math.floor(timers.now() / 1_000) * 1_000)
                : new Date(timers.now()),
            ...(ports.flatpak ? { launchToken: ports.newLaunchToken() } : {}),
        };
    } catch (error) {
        log.warn("Could not snapshot existing Beat Saber processes; continuing without launch ownership", error);
        return undefined;
    }
}

function processStartedAt(processDetails: ProcessInfo): Date | undefined {
    const startedAt = processDetails.startTime;
    return startedAt && Number.isFinite(startedAt.getTime()) ? startedAt : undefined;
}

function processTargetsExecutable(
    processDetails: ProcessInfo,
    executablePath: string,
    launchedAfter: Date,
    platform: NodeJS.Platform,
    allowUnavailablePath = false
): boolean {
    const processName = platform === "linux"
        ? path.posix.basename((processDetails.name ?? "").replaceAll("\\", "/"))
        : path.win32.basename(processDetails.name ?? "");
    if (!Number.isSafeInteger(processDetails.pid) || processDetails.pid <= 0
        || processName.toLowerCase() !== processNameOf(executablePath, platform).toLowerCase()) {
        return false;
    }

    const startedAt = processStartedAt(processDetails);
    if (startedAt === undefined || startedAt.getTime() < launchedAfter.getTime()) {
        return false;
    }
    if (!processDetails.cmd) {
        return platform === "win32" && allowUnavailablePath;
    }

    if (platform === "linux") {
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

const isValidPid = (pid?: number) => Number.isSafeInteger(pid) && (pid ?? 0) > 0;

function selectOwnedProcess(
    processes: ProcessInfo[],
    search: Omit<OwnershipSearch, "signal">,
    platform: NodeJS.Platform
): ProcessInfo | undefined {
    const { snapshot: { existingProcessIds, launchedAfter, launchToken }, executablePath, launcherPid } = search;
    if (!launchToken && !isValidPid(launcherPid)) {
        return undefined;
    }

    const candidates = processes.filter(processDetails => !existingProcessIds.has(processDetails.pid)
        && (launchToken
            ? processDetails.launchToken === launchToken
            : (processDetails.ppid === launcherPid
                || (platform === "linux"
                    && (processDetails.processGroupId === launcherPid
                        || processDetails.ancestorPids?.includes(launcherPid)))))
        && processTargetsExecutable(processDetails, executablePath, launchedAfter, platform, true));
    return candidates.length === 1 ? candidates[0] : undefined;
}

async function findOwnedProcess(
    search: OwnershipSearch,
    ports: OwnedProcessSessionPorts
): Promise<OwnedProcessIdentity | undefined> {
    const { snapshot, executablePath, launcherPid, signal } = search;
    const { timers } = ports;
    if (!snapshot.launchToken && !isValidPid(launcherPid)) {
        return undefined;
    }

    const deadline = timers.now() + OWNED_PROCESS_ACQUISITION_TIMEOUT_MS;
    const waitForNextAttempt = () => {
        const remainingMs = deadline - timers.now();
        if (remainingMs <= 0 || signal.aborted) {
            return Promise.resolve(false);
        }
        return delay(timers, Math.min(OWNED_PROCESS_FIND_INTERVAL_MS, remainingMs), signal);
    };

    do {
        let processes: ProcessInfo[];
        try {
            processes = await listGameProcesses(executablePath, ports, {
                signal, deadline, launchToken: snapshot.launchToken,
            });
        } catch (error) {
            if (signal.aborted) {
                return undefined;
            }
            if (deadline - timers.now() <= 0) {
                throw error;
            }
            if (!(await waitForNextAttempt())) {
                return undefined;
            }
            continue;
        }

        const ownedProcess = selectOwnedProcess(processes, search, ports.platform);
        const startedAt = ownedProcess && processStartedAt(ownedProcess);
        if (ownedProcess && startedAt && !signal.aborted && timers.now() < deadline) {
            return {
                pid: ownedProcess.pid,
                startedAt,
                ...(ownedProcess.startMarker ? { startMarker: ownedProcess.startMarker } : {}),
            };
        }

        if (!(await waitForNextAttempt())) {
            return undefined;
        }
    } while (timers.now() < deadline);

    return undefined;
}

function processMatchesOwnedIdentity(
    processDetails: ProcessInfo,
    executablePath: string,
    ownedProcess: OwnedProcessIdentity,
    platform: NodeJS.Platform
): boolean {
    return processDetails.pid === ownedProcess.pid
        && processTargetsExecutable(processDetails, executablePath, ownedProcess.startedAt, platform, true)
        && processStartedAt(processDetails)?.getTime() === ownedProcess.startedAt.getTime()
        && (ownedProcess.startMarker === undefined
            || processDetails.startMarker === ownedProcess.startMarker);
}

async function waitForOwnedProcessExit(
    executablePath: string,
    ownedProcess: OwnedProcessIdentity,
    signal: AbortSignal,
    ports: OwnedProcessSessionPorts
): Promise<boolean> {
    while (!signal.aborted) {
        const processes = await listGameProcesses(executablePath, ports, { signal });
        if (!processes.some(processDetails => processMatchesOwnedIdentity(
            processDetails,
            executablePath,
            ownedProcess,
            ports.platform
        ))) {
            return true;
        }
        if (!(await delay(ports.timers, OWNED_PROCESS_EXIT_POLL_INTERVAL_MS, signal))) {
            return false;
        }
    }
    return false;
}
