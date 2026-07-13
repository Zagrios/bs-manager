import { EventEmitter } from "events";
import { AbstractLauncherService, LaunchBeatSaberOptions } from "main/services/bs-launcher/abstract-launcher.service";
import { bsmSpawn, getProcessesByName } from "main/helpers/os.helpers";
import { ChildProcess, execFile } from "child_process";
import { app } from "electron";
import { StaticConfigurationService } from "main/services/static-configuration.service";

jest.mock("electron", () => {
    const events = new (jest.requireActual("events").EventEmitter)();
    return {
        app: {
            emit: events.emit.bind(events),
            on: events.on.bind(events),
            removeAllListeners: events.removeAllListeners.bind(events),
            removeListener: events.removeListener.bind(events),
            quit: jest.fn(),
        },
    };
});
jest.mock("electron-log", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
jest.mock("child_process", () => ({
    ...jest.requireActual("child_process"),
    execFile: jest.fn(),
}));
jest.mock("main/helpers/os.helpers", () => ({
    BsmShellLog: { Command: 1 },
    bsmSpawn: jest.fn(),
    getProcessesByName: jest.fn(),
}));
jest.mock("main/services/linux.service", () => ({ LinuxService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/static-configuration.service", () => ({ StaticConfigurationService: { getInstance: jest.fn() } }));
jest.mock("main/constants", () => ({ BS_EXECUTABLE: "Beat Saber.exe", IS_FLATPAK: false }));

type OwnershipSnapshot = {
    existingProcessIds: Set<number>;
    launchedAfter: Date;
};

class TestLauncher extends AbstractLauncherService {
    public start(options: LaunchBeatSaberOptions, ownershipSnapshot?: OwnershipSnapshot) {
        return (this.launchBeatSaber as any)(options, ownershipSnapshot);
    }

    public spawn(options: LaunchBeatSaberOptions) {
        return this.launchBeatSaberProcess(options);
    }

    public enumerateProcesses(deadline: number) {
        return this.getProcessesWithRetry("Beat Saber.exe", undefined, deadline);
    }
}

const launchOptions: LaunchBeatSaberOptions = {
    cmdlet: "Beat Saber.exe",
    env: {},
    customEnv: {},
    beatSaberFolderPath: "C:\\Beat Saber",
};

function childProcess(pid = 42): ChildProcess {
    return Object.assign(new EventEmitter(), {
        exitCode: null,
        killed: false,
        pid,
        unref: jest.fn(),
    }) as unknown as ChildProcess;
}

async function flushPromises(): Promise<void> {
    for (let attempt = 0; attempt < 8; attempt++) {
        await Promise.resolve();
    }
}

describe("AbstractLauncherService process lifecycle", () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
        jest.clearAllMocks();
        (app as any).removeAllListeners();
        (StaticConfigurationService.getInstance as jest.Mock).mockReturnValue({
            get: jest.fn(() => false),
        });
        (getProcessesByName as jest.Mock).mockResolvedValue([]);
        Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
    });

    afterAll(() => {
        Object.defineProperty(process, "platform", { configurable: true, value: originalPlatform });
    });

    it("keeps Oculus-style launches pending until the spawned process exits", async () => {
        const process = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(process);
        const launcher = new TestLauncher();

        let settled = false;
        const exit = launcher.start(launchOptions).exit.then((code: number) => {
            settled = true;
            return code;
        });

        await Promise.resolve();
        expect(settled).toBe(false);
        expect(process.unref).not.toHaveBeenCalled();

        process.emit("exit", 0);
        await expect(exit).resolves.toBe(0);
    });

    it("ignores stdio for a detached process that may be unrefed on quit", () => {
        (bsmSpawn as jest.Mock).mockReturnValue(childProcess());
        const launcher = new TestLauncher();

        launcher.spawn(launchOptions);

        expect(bsmSpawn).toHaveBeenCalledWith("Beat Saber.exe", expect.objectContaining({
            options: expect.objectContaining({
                detached: true,
                stdio: "ignore",
            }),
        }));
    });

    it("auto-closes without any focus action only after acquiring a safely owned Oculus process", async () => {
        const wrapper = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (StaticConfigurationService.getInstance as jest.Mock).mockReturnValue({
            get: jest.fn(() => true),
        });
        (getProcessesByName as jest.Mock).mockResolvedValue([{
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
        }]);
        const launcher = new TestLauncher();

        const launch = launcher.start(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter: new Date("2026-07-13T08:00:00.000Z"),
        });
        await flushPromises();

        expect(execFile).not.toHaveBeenCalled();
        expect(app.quit).toHaveBeenCalledTimes(1);

        wrapper.emit("exit", 0);
        await expect(launch.exit).resolves.toBe(0);
    });

    it("does not auto-close or focus for an unowned concurrent Oculus process", async () => {
        const wrapper = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (StaticConfigurationService.getInstance as jest.Mock).mockReturnValue({
            get: jest.fn(() => true),
        });
        (getProcessesByName as jest.Mock).mockResolvedValue([{
            pid: 85,
            ppid: 77,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
        }]);
        const launcher = new TestLauncher();

        const launch = launcher.start(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter: new Date("2026-07-13T08:00:00.000Z"),
        });
        await flushPromises();

        expect(execFile).not.toHaveBeenCalled();
        expect(app.quit).not.toHaveBeenCalled();

        wrapper.emit("error", new Error("cancel unowned acquisition"));
        await expect(launch.exit).rejects.toThrow("cancel unowned acquisition");
    });

    it("performs no focus or close action when launch ownership is cancelled by failure", async () => {
        const wrapper = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (StaticConfigurationService.getInstance as jest.Mock).mockReturnValue({
            get: jest.fn(() => true),
        });
        (getProcessesByName as jest.Mock).mockReturnValue(new Promise(() => {
            // Remains pending until ownership cancellation.
        }));
        const launcher = new TestLauncher();

        const launch = launcher.start(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter: new Date("2026-07-13T08:00:00.000Z"),
        });
        wrapper.emit("error", new Error("spawn failed"));
        await expect(launch.exit).rejects.toThrow("spawn failed");

        expect(execFile).not.toHaveBeenCalled();
        expect(app.quit).not.toHaveBeenCalled();
    });

    it("does not start another process enumeration after the deadline expires", async () => {
        jest.useFakeTimers({ now: 1_000 });
        try {
            (getProcessesByName as jest.Mock).mockReturnValue(new Promise(() => {
                // Remains pending until the enumeration deadline.
            }));
            const launcher = new TestLauncher();
            const enumeration = launcher.enumerateProcesses(Date.now() + 50);
            const enumerationError = enumeration.catch(error => error);

            await jest.advanceTimersByTimeAsync(50);

            expect(await enumerationError).toMatchObject({ message: "Process enumeration timed out" });
            expect(getProcessesByName).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });

    it("does not prevent or restart quit when Linux has no ownership identity", async () => {
        Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
        const wrapper = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (StaticConfigurationService.getInstance as jest.Mock).mockReturnValue({
            get: jest.fn(() => true),
        });
        (getProcessesByName as jest.Mock).mockReturnValue(new Promise(() => {
            // Remains pending until quit cancels ownership.
        }));
        const launcher = new TestLauncher();
        const launch = launcher.start(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter: new Date("2026-07-13T08:00:00.000Z"),
        });
        const quitEvent = { preventDefault: jest.fn() };

        (app as any).emit("will-quit", quitEvent);
        await flushPromises();

        expect(quitEvent.preventDefault).not.toHaveBeenCalled();
        expect(wrapper.unref).toHaveBeenCalledTimes(1);
        expect(app.quit).not.toHaveBeenCalled();
        expect(execFile).not.toHaveBeenCalled();
        await expect(launch.ownership).resolves.toBeUndefined();
    });

    it("auto-closes for the one safely owned Linux Beat Saber descendant", async () => {
        Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
        const wrapper = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (StaticConfigurationService.getInstance as jest.Mock).mockReturnValue({
            get: jest.fn(() => true),
        });
        (getProcessesByName as jest.Mock).mockResolvedValue([{
            pid: 85,
            ppid: 60,
            ancestorPids: [60, 42, 1],
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
            startMarker: "12345",
        }]);
        const launcher = new TestLauncher();

        const launch = launcher.start({
            ...launchOptions,
            beatSaberFolderPath: "/games/Beat Saber",
        }, {
            existingProcessIds: new Set(),
            launchedAfter: new Date("2026-07-13T08:00:00.000Z"),
        });
        await flushPromises();

        await expect(launch.ownership).resolves.toEqual({
            pid: 85,
            startedAt: new Date("2026-07-13T08:00:00.001Z"),
            startMarker: "12345",
        });
        expect(app.quit).toHaveBeenCalledTimes(1);

        wrapper.emit("exit", 0);
        await expect(launch.exit).resolves.toBe(0);
    });

    it("rejects a concurrent manual Linux process without wrapper ancestry", () => {
        Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
        const launcher = new TestLauncher();

        const selected = (launcher as any).selectOwnedProcess([{
            pid: 85,
            ppid: 77,
            ancestorPids: [77, 1],
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
            startMarker: "12345",
        }], new Set(), "/games/Beat Saber/Beat Saber.exe", new Date("2026-07-13T08:00:00.000Z"), 42);

        expect(selected).toBeUndefined();
    });

    it("continues Linux ownership proof after the wrapper exits nonzero", async () => {
        Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
        const wrapper = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (StaticConfigurationService.getInstance as jest.Mock).mockReturnValue({
            get: jest.fn(() => true),
        });
        let resolveProcesses: (processes: unknown[]) => void;
        (getProcessesByName as jest.Mock).mockReturnValue(new Promise<unknown[]>(resolve => {
            resolveProcesses = resolve;
        }));
        const launcher = new TestLauncher();
        const launch = launcher.start({
            ...launchOptions,
            beatSaberFolderPath: "/games/Beat Saber",
        }, {
            existingProcessIds: new Set(),
            launchedAfter: new Date("2026-07-13T08:00:00.000Z"),
        });

        wrapper.emit("exit", 7);
        await expect(launch.exit).resolves.toBe(7);
        expect(app.quit).not.toHaveBeenCalled();

        resolveProcesses!([{
            pid: 85,
            ppid: 60,
            ancestorPids: [60, 42, 1],
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
            startMarker: "12345",
        }]);

        await expect(launch.ownership).resolves.toMatchObject({ pid: 85, startMarker: "12345" });
        expect(app.quit).toHaveBeenCalledTimes(1);
    });

    it("keeps quit cancellation active after a successful wrapper exit until ownership settles", async () => {
        const wrapper = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (getProcessesByName as jest.Mock).mockReturnValue(new Promise(() => {
            // Remains pending until quit cancels ownership.
        }));
        const launcher = new TestLauncher();
        const launch = launcher.start(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter: new Date("2026-07-13T08:00:00.000Z"),
        });
        const quitEvent = { preventDefault: jest.fn() };

        wrapper.emit("exit", 0);
        await expect(launch.exit).resolves.toBe(0);
        (app as any).emit("will-quit", quitEvent);
        await launch.ownership;

        expect(quitEvent.preventDefault).not.toHaveBeenCalled();
        expect(wrapper.unref).toHaveBeenCalledTimes(1);
        expect(launch.signal.aborted).toBe(true);
    });
});
