import { EventEmitter } from "events";
import { ChildProcess } from "node:child_process";
import log from "electron-log";
import { ProcessInfo, ProcessQuery } from "main/helpers/process-table";
import {
    launchOwnedProcess,
    OwnedProcessLaunch,
    OwnedProcessSessionPorts,
    ProcessTrackingError,
    systemTimers,
} from "main/services/bs-launcher/owned-process-session";

jest.mock("electron", () => ({ app: { getPath: () => "" } }));
jest.mock("electron-log", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const launchedAt = new Date("2026-07-13T08:00:00.000Z");
const startedAt = new Date("2026-07-13T08:00:00.001Z");
const WINDOWS_EXE = "C:/Beat Saber/Beat Saber.exe";
const LINUX_EXE = "/games/Beat Saber/Beat Saber.exe";

const windowsGame = (overrides: Partial<ProcessInfo> = {}): ProcessInfo => ({
    pid: 85,
    ppid: 42,
    name: "Beat Saber.exe",
    cmd: WINDOWS_EXE,
    startTime: startedAt,
    ...overrides,
});

const linuxGame = (overrides: Partial<ProcessInfo> = {}): ProcessInfo => ({
    pid: 85,
    ppid: 60,
    ancestorPids: [60, 42, 1],
    name: "Beat Saber.exe",
    cmd: `wine ${LINUX_EXE} fpfc`,
    startTime: startedAt,
    startMarker: "12345",
    ...overrides,
});

type FakeChild = ChildProcess & { unref: jest.Mock; stdout: (EventEmitter & { destroy: jest.Mock }) | null };

function childProcess(pid = 42, withStdout = false): FakeChild {
    return Object.assign(new EventEmitter(), {
        exitCode: null,
        killed: false,
        pid,
        stdout: withStdout ? Object.assign(new EventEmitter(), { destroy: jest.fn() }) : null,
        kill: jest.fn(),
        unref: jest.fn(),
    }) as unknown as FakeChild;
}

function fakeLifecycle() {
    const listeners = new Set<() => void>();
    return {
        onWillQuit: jest.fn((listener: () => void) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        }),
        quit: jest.fn(),
        emitWillQuit: () => [...listeners].forEach(listener => listener()),
        listenerCount: () => listeners.size,
    };
}

function setup(options: { platform?: NodeJS.Platform; flatpak?: boolean } = {}) {
    const processes = { list: jest.fn<Promise<ProcessInfo[]>, [ProcessQuery]>().mockResolvedValue([]) };
    const lifecycle = fakeLifecycle();
    const ports: OwnedProcessSessionPorts = {
        processes,
        timers: systemTimers,
        lifecycle,
        platform: options.platform ?? "win32",
        flatpak: options.flatpak ?? false,
        newLaunchToken: () => "owned-token",
    };
    const launcher = childProcess();
    const spawn = jest.fn<ReturnType<OwnedProcessLaunch["spawn"]>, Parameters<OwnedProcessLaunch["spawn"]>>(
        () => ({ process: launcher })
    );
    const onStarted = jest.fn();
    const start = (overrides: Partial<OwnedProcessLaunch> = {}) => launchOwnedProcess({
        executablePath: ports.platform === "linux" ? LINUX_EXE : WINDOWS_EXE,
        spawn,
        onStarted,
        ...overrides,
    }, ports);
    return { ports, processes, lifecycle, launcher, spawn, onStarted, start };
}

function deferred<T>() {
    let resolveDeferred!: (value: T) => void;
    let rejectDeferred!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolve, reject) => {
        resolveDeferred = resolve;
        rejectDeferred = reject;
    });
    return { promise, resolve: resolveDeferred, reject: rejectDeferred };
}

const flush = () => jest.advanceTimersByTimeAsync(0);
const pending = () => new Promise<ProcessInfo[]>(() => {
});

function settledState<T>(promise: Promise<T>) {
    const state = { settled: false };
    promise.then(() => { state.settled = true; }, () => { state.settled = true; });
    return state;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: launchedAt });
});

afterEach(() => {
    jest.useRealTimers();
});

describe("Owned process session: snapshot and spawn", () => {
    it("snapshots running copies by executable name before spawning, without a token outside Flatpak", async () => {
        const { processes, spawn, start } = setup();
        const order: string[] = [];
        processes.list.mockImplementation(async () => { order.push("list"); return []; });
        spawn.mockImplementation(() => { order.push("spawn"); return { process: childProcess() }; });

        await start();

        expect(order.slice(0, 2)).toEqual(["list", "spawn"]);
        expect(processes.list).toHaveBeenNthCalledWith(1, { name: "Beat Saber.exe" });
        expect(spawn).toHaveBeenCalledWith({ launchToken: undefined, signal: expect.any(AbortSignal) });
    });

    it("continues untracked when the snapshot cannot be taken", async () => {
        const { processes, launcher, onStarted, spawn, start } = setup({ platform: "linux", flatpak: true });
        processes.list.mockRejectedValue(new Error("host ps failed"));

        const sessionPromise = start();
        await jest.advanceTimersByTimeAsync(5_000);
        const session = await sessionPromise;

        expect(processes.list).toHaveBeenCalledTimes(3);
        expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ launchToken: undefined }));
        await expect(session.started).resolves.toBeUndefined();
        launcher.emit("exit", 0);
        await expect(session.exit).resolves.toBe(0);
        expect(onStarted).not.toHaveBeenCalled();
        expect(processes.list).toHaveBeenCalledTimes(3);
    });

    it("does not start another enumeration after a hung one times out", async () => {
        const { processes, start } = setup();
        processes.list.mockReturnValue(pending());

        const sessionPromise = start();
        await jest.advanceTimersByTimeAsync(5_000);
        await sessionPromise;

        expect(processes.list).toHaveBeenCalledTimes(1);
    });
});

describe("Owned process session: acquisition", () => {
    it("claims the game once it appears after several polls, and only then reports it started", async () => {
        const { processes, launcher, onStarted, start } = setup();
        processes.list.mockImplementation(async () => (
            Date.now() >= launchedAt.getTime() + 6_000 ? [windowsGame()] : []
        ));
        const session = await start();
        launcher.emit("exit", 0);

        await jest.advanceTimersByTimeAsync(5_900);
        expect(onStarted).not.toHaveBeenCalled();
        expect(processes.list.mock.calls.length).toBeGreaterThan(10);

        await jest.advanceTimersByTimeAsync(100);
        expect(onStarted).toHaveBeenCalledTimes(1);
        expect(onStarted).toHaveBeenCalledWith({ pid: 85, startedAt });
        await expect(session.started).resolves.toEqual({ pid: 85, startedAt });

        processes.list.mockResolvedValue([]);
        await jest.advanceTimersByTimeAsync(1_000);
        await expect(session.exit).resolves.toBe(0);
    });

    it("stops at the acquisition deadline and reports the launcher exit code", async () => {
        const { processes, launcher, lifecycle, onStarted, start } = setup();
        const session = await start();
        launcher.emit("exit", 0);

        await jest.advanceTimersByTimeAsync(60_000);
        await expect(session.exit).resolves.toBe(0);
        const callsAtDeadline = processes.list.mock.calls.length;
        await jest.advanceTimersByTimeAsync(10_000);

        expect(processes.list).toHaveBeenCalledTimes(callsAtDeadline);
        expect(onStarted).not.toHaveBeenCalled();
        expect(lifecycle.listenerCount()).toBe(0);
    });

    it("waits for ownership after a nonzero launcher exit, then follows the owned game", async () => {
        const { processes, launcher, onStarted, start } = setup();
        const acquisition = deferred<ProcessInfo[]>();
        const concurrent = windowsGame({ pid: 86, ppid: 77 });
        processes.list
            .mockResolvedValueOnce([])
            .mockReturnValueOnce(acquisition.promise)
            .mockResolvedValueOnce([windowsGame(), concurrent])
            .mockResolvedValue([concurrent]);
        const session = await start();
        const exit = settledState(session.exit);

        launcher.emit("exit", 7);
        await flush();
        expect(exit.settled).toBe(false);
        expect(onStarted).not.toHaveBeenCalled();

        acquisition.resolve([windowsGame(), concurrent]);
        await flush();
        expect(onStarted).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1_000);
        await expect(session.exit).resolves.toBe(0);
    });

    it("reports the launcher exit code when ownership settles without a game", async () => {
        const { processes, launcher, start } = setup({ platform: "linux" });
        const acquisition = deferred<ProcessInfo[]>();
        processes.list.mockResolvedValueOnce([linuxGame({ pid: 70 })]).mockReturnValueOnce(acquisition.promise);
        const session = await start();
        const exit = settledState(session.exit);

        launcher.emit("exit", 7);
        await flush();
        expect(exit.settled).toBe(false);

        acquisition.resolve([linuxGame({ pid: 70 })]);
        processes.list.mockResolvedValue([linuxGame({ pid: 70 })]);
        await jest.advanceTimersByTimeAsync(60_000);
        await expect(session.exit).resolves.toBe(7);
    });

    it("keeps acquiring after repeated enumeration timeouts", async () => {
        const { processes, onStarted, start } = setup();
        processes.list
            .mockResolvedValueOnce([])
            .mockImplementationOnce(pending)
            .mockImplementationOnce(pending)
            .mockImplementationOnce(pending)
            .mockResolvedValueOnce([windowsGame()])
            .mockReturnValue(pending());
        await start();

        await jest.advanceTimersByTimeAsync(16_000);

        expect(onStarted).toHaveBeenCalledWith({ pid: 85, startedAt });
    });

    it("rejects exit with a tracking error when the table stays unreadable until the deadline", async () => {
        const { processes, launcher, onStarted, start } = setup();
        const enumerationError = new Error("process list unavailable");
        processes.list.mockResolvedValueOnce([]).mockRejectedValue(enumerationError);
        const session = await start();
        launcher.emit("exit", 0);
        const outcome = session.exit.catch(error => error);

        await jest.advanceTimersByTimeAsync(60_000);

        const error = await outcome;
        expect(error).toBeInstanceOf(ProcessTrackingError);
        expect(error).toMatchObject({ message: enumerationError.message, cause: enumerationError });
        expect(onStarted).not.toHaveBeenCalled();
    });

    it("falls back to the launcher exit code on acquisition failure when untracked", async () => {
        const { processes, launcher, start } = setup();
        const enumerationError = new Error("process list unavailable");
        processes.list.mockResolvedValueOnce([]).mockRejectedValue(enumerationError);
        const session = await start({ onAcquisitionFailure: "untracked" });
        launcher.emit("exit", 3);

        await jest.advanceTimersByTimeAsync(60_000);

        await expect(session.exit).resolves.toBe(3);
        expect(log.error).toHaveBeenCalledWith("Could not acquire the launched Beat Saber process", enumerationError);
    });
});

describe("Owned process session: owned game exit", () => {
    it("resolves 0 when the owned identity disappears, treating a reused pid as exited", async () => {
        const { processes, launcher, start } = setup({ platform: "linux" });
        processes.list.mockResolvedValueOnce([]).mockResolvedValue([linuxGame()]);
        const session = await start();
        await expect(session.started).resolves.toEqual({ pid: 85, startedAt, startMarker: "12345" });
        const exit = settledState(session.exit);

        await jest.advanceTimersByTimeAsync(3_000);
        expect(exit.settled).toBe(false);

        processes.list.mockResolvedValue([linuxGame({ startMarker: "99999" })]);
        await jest.advanceTimersByTimeAsync(1_000);
        await expect(session.exit).resolves.toBe(0);
        launcher.emit("exit", 1);
    });

    it("rejects with a tracking error when watching the owned game fails, and ends the session", async () => {
        const { processes, lifecycle, start } = setup();
        const monitorError = new Error("monitor failed");
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([windowsGame()]).mockRejectedValue(monitorError);
        const session = await start();
        const outcome = session.exit.catch(error => error);

        await jest.advanceTimersByTimeAsync(5_000);

        const error = await outcome;
        expect(error).toBeInstanceOf(ProcessTrackingError);
        expect(error.cause).toBe(monitorError);
        expect(lifecycle.listenerCount()).toBe(0);
    });
});

describe("Owned process session: launcher failure and app quit", () => {
    it("rejects with the launcher error and cancels acquisition without reporting a start", async () => {
        const { processes, launcher, onStarted, lifecycle, start } = setup();
        processes.list.mockResolvedValueOnce([]).mockReturnValue(pending());
        const session = await start();

        launcher.emit("error", new Error("spawn failed"));

        await expect(session.exit).rejects.toThrow("spawn failed");
        await jest.advanceTimersByTimeAsync(10_000);
        expect(processes.list).toHaveBeenCalledTimes(2);
        expect(onStarted).not.toHaveBeenCalled();
        expect(lifecycle.listenerCount()).toBe(0);
    });

    it("does not report a start found after the launcher failed", async () => {
        const { processes, launcher, onStarted, start } = setup();
        const acquisition = deferred<ProcessInfo[]>();
        processes.list.mockResolvedValueOnce([]).mockReturnValueOnce(acquisition.promise);
        const session = await start();

        launcher.emit("error", new Error("cancel acquisition"));
        acquisition.resolve([windowsGame()]);

        await expect(session.exit).rejects.toThrow("cancel acquisition");
        expect(onStarted).not.toHaveBeenCalled();
    });

    it("unrefs the launcher on quit before ownership is known, without quitting again", async () => {
        const { processes, launcher, lifecycle, onStarted, start } = setup({ platform: "linux" });
        processes.list.mockResolvedValueOnce([]).mockReturnValue(pending());
        const session = await start();

        lifecycle.emitWillQuit();
        await flush();

        expect(launcher.unref).toHaveBeenCalledTimes(1);
        expect(lifecycle.quit).not.toHaveBeenCalled();
        expect(lifecycle.listenerCount()).toBe(0);
        await expect(session.started).resolves.toBeUndefined();
        expect(onStarted).not.toHaveBeenCalled();

        launcher.emit("exit", 0);
        await expect(session.exit).resolves.toBe(0);
    });

    it("keeps listening for quit after a successful launcher exit until ownership settles", async () => {
        const { processes, launcher, lifecycle, start } = setup();
        processes.list.mockResolvedValueOnce([]).mockReturnValue(pending());
        const session = await start();

        launcher.emit("exit", 0);
        await flush();
        expect(lifecycle.listenerCount()).toBe(1);

        lifecycle.emitWillQuit();
        await expect(session.exit).resolves.toBe(0);
        expect(launcher.unref).toHaveBeenCalledTimes(1);
    });

    it("stops watching an owned game on quit and leaves it running", async () => {
        const { processes, launcher, lifecycle, onStarted, start } = setup();
        processes.list.mockResolvedValueOnce([]).mockResolvedValue([windowsGame()]);
        const session = await start();
        await flush();
        expect(onStarted).toHaveBeenCalledTimes(1);

        lifecycle.emitWillQuit();

        await expect(session.exit).resolves.toBe(0);
        expect(launcher.unref).toHaveBeenCalledTimes(1);
        expect(launcher.kill).not.toHaveBeenCalled();
        expect(lifecycle.listenerCount()).toBe(0);
        const calls = processes.list.mock.calls.length;
        await jest.advanceTimersByTimeAsync(5_000);
        expect(processes.list).toHaveBeenCalledTimes(calls);
    });
});

describe("Owned process session: matching rules", () => {
    it.each<[string, boolean, Partial<ProcessInfo>]>([
        ["the launcher's child", true, {}],
        ["a concurrent manual launch", false, { ppid: 77 }],
        ["another copy of the game", false, { cmd: "C:/Other Copy/Beat Saber.exe" }],
        ["a quoted path with arguments", true, { cmd: "\"C:\\Beat Saber\\Beat Saber.exe\" fpfc" }],
        ["another executable", false, { name: "Other.exe" }],
        ["an invalid pid", false, { pid: 0 }],
        ["a process started before the launch", false, { startTime: new Date(launchedAt.getTime() - 1) }],
        ["an elevated child with a hidden path", true, { cmd: undefined }],
    ])("on Windows, %s is claimed: %s", async (_label, claimed, overrides) => {
        const { processes, onStarted, start } = setup();
        processes.list.mockResolvedValueOnce([]).mockResolvedValue([windowsGame(overrides)]);
        await start();

        await jest.advanceTimersByTimeAsync(1_000);

        expect(onStarted).toHaveBeenCalledTimes(claimed ? 1 : 0);
    });

    it("does not claim two candidates at once", async () => {
        const { processes, onStarted, start } = setup();
        processes.list.mockResolvedValueOnce([]).mockResolvedValue([windowsGame(), windowsGame({ pid: 86 })]);
        await start();

        await jest.advanceTimersByTimeAsync(1_000);

        expect(onStarted).not.toHaveBeenCalled();
    });

    it.each<[string, boolean, Partial<ProcessInfo>]>([
        ["a Proton descendant", true, {}],
        ["a member of the launcher process group", true, { ancestorPids: [1], processGroupId: 42 }],
        ["a path reported through the Z: drive", true, { cmd: `Z:${LINUX_EXE}` }],
        ["a concurrent launch without launcher ancestry", false, { ppid: 77, ancestorPids: [77, 1] }],
        ["a path that only prefixes the command", false, { cmd: `wine ${LINUX_EXE}.bak` }],
        ["a process without a command line", false, { cmd: undefined }],
    ])("on Linux, %s is claimed: %s", async (_label, claimed, overrides) => {
        const { processes, onStarted, start } = setup({ platform: "linux" });
        processes.list.mockResolvedValueOnce([]).mockResolvedValue([linuxGame(overrides)]);
        await start();

        await jest.advanceTimersByTimeAsync(1_000);

        expect(onStarted).toHaveBeenCalledTimes(claimed ? 1 : 0);
    });

    it("under Flatpak, owns only the host process carrying its launch token", async () => {
        const { processes, spawn, onStarted, start } = setup({ platform: "linux", flatpak: true });
        processes.list.mockResolvedValueOnce([]).mockResolvedValue([
            linuxGame({ ppid: 777, ancestorPids: undefined, launchToken: "owned-token" }),
            linuxGame({ pid: 86, ppid: 42, ancestorPids: undefined, launchToken: "other-launch" }),
        ]);

        await start();
        await flush();

        expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ launchToken: "owned-token" }));
        expect(processes.list).toHaveBeenNthCalledWith(2, { name: "Beat Saber.exe", launchToken: "owned-token" });
        expect(onStarted).toHaveBeenCalledWith(expect.objectContaining({ pid: 85 }));
    });

    it("under Flatpak, does not claim pre-existing or concurrent host processes", async () => {
        const { processes, launcher, onStarted, start } = setup({ platform: "linux", flatpak: true });
        const preExisting = linuxGame({ startTime: new Date("2026-07-13T07:59:59.000Z") });
        processes.list.mockResolvedValueOnce([preExisting]).mockResolvedValue([
            { ...preExisting, launchToken: "owned-token" },
            linuxGame({ pid: 86, launchToken: "concurrent-launch" }),
        ]);
        const session = await start();

        await jest.advanceTimersByTimeAsync(60_000);

        await expect(session.started).resolves.toBeUndefined();
        expect(onStarted).not.toHaveBeenCalled();
        launcher.emit("exit", 0);
        await expect(session.exit).resolves.toBe(0);
    });
});

describe("Owned process session: launcher pid reported later (elevated launch)", () => {
    it("owns only the child of the reported helper pid", async () => {
        const { processes, onStarted, start } = setup();
        const helperPid = deferred<number>();
        const powershell = childProcess(42, true);
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([
            windowsGame({ cmd: undefined }),
            windowsGame({ pid: 86, ppid: 84, cmd: undefined }),
        ]).mockResolvedValue([]);
        const session = await start({ spawn: () => ({ process: powershell, launcherPid: helperPid.promise }) });

        await flush();
        expect(processes.list).toHaveBeenCalledTimes(1);

        helperPid.resolve(84);
        await flush();
        expect(onStarted).toHaveBeenCalledWith({ pid: 86, startedAt });

        await jest.advanceTimersByTimeAsync(1_000);
        await expect(session.exit).resolves.toBe(0);
    });

    it("fails and detaches the launcher when the pid never arrives, even without a snapshot", async () => {
        const { processes, lifecycle, start } = setup();
        processes.list.mockRejectedValue(new Error("process list unavailable"));
        const helperPid = deferred<number>();
        const powershell = childProcess(42, true);
        const sessionPromise = start({ spawn: () => ({ process: powershell, launcherPid: helperPid.promise }) });
        await jest.advanceTimersByTimeAsync(5_000);
        const session = await sessionPromise;

        helperPid.reject(new Error("Elevated helper PID acquisition timed out"));

        await expect(session.exit).rejects.toThrow("Elevated helper PID acquisition timed out");
        expect(powershell.unref).toHaveBeenCalledTimes(1);
        expect(powershell.stdout!.destroy).toHaveBeenCalledTimes(1);
        expect(lifecycle.listenerCount()).toBe(0);
    });

    it("destroys the pid channel and unrefs the launcher on quit", async () => {
        const { lifecycle, start } = setup();
        const powershell = childProcess(42, true);
        await start({ spawn: () => ({ process: powershell, launcherPid: deferred<number>().promise }) });

        lifecycle.emitWillQuit();

        expect(powershell.unref).toHaveBeenCalledTimes(1);
        expect(powershell.stdout!.destroy).toHaveBeenCalledTimes(1);
    });
});
