import { EventEmitter } from "events";
import { ChildProcess } from "child_process";
import { app } from "electron";
import { bsmSpawn, getProcessesByName } from "main/helpers/os.helpers";
import { AbstractLauncherService, LaunchBeatSaberOptions, ProcessOwnershipSnapshot } from "main/services/bs-launcher/abstract-launcher.service";
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
jest.mock("main/helpers/os.helpers", () => ({
    BSM_LAUNCH_TOKEN_ENV: "BSMANAGER_LAUNCH_TOKEN",
    BsmShellLog: { Command: 1 },
    bsmSpawn: jest.fn(),
    getProcessesByName: jest.fn(),
}));
jest.mock("main/services/linux.service", () => ({ LinuxService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/static-configuration.service", () => ({ StaticConfigurationService: { getInstance: jest.fn() } }));
jest.mock("main/constants", () => ({ BS_EXECUTABLE: "Beat Saber.exe", IS_FLATPAK: true }));

class TestLauncher extends AbstractLauncherService {
    public snapshot() {
        return this.createProcessOwnershipSnapshot();
    }

    public start(options: LaunchBeatSaberOptions, ownershipSnapshot?: ProcessOwnershipSnapshot) {
        return this.launchBeatSaber(options, ownershipSnapshot);
    }
}

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

const originalPlatform = process.platform;
const launchTime = new Date("2026-07-13T08:00:00.000Z");

beforeAll(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
});

afterAll(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: originalPlatform });
});

beforeEach(() => {
    jest.useFakeTimers({ now: launchTime });
    jest.clearAllMocks();
    (app as any).removeAllListeners();
    (StaticConfigurationService.getInstance as jest.Mock).mockReturnValue({ get: jest.fn(() => true) });
});

afterEach(() => {
    jest.useRealTimers();
});

describe("Flatpak launch ownership", () => {
    it("owns only host process carrying unique token injected into flatpak-spawn", async () => {
        const wrapper = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (getProcessesByName as jest.Mock).mockResolvedValueOnce([]);
        const launcher = new TestLauncher();
        const snapshot = await launcher.snapshot();
        expect(snapshot?.launchToken).toEqual(expect.any(String));
        (getProcessesByName as jest.Mock).mockResolvedValueOnce([{
            pid: 85,
            ppid: 777,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
            launchToken: snapshot!.launchToken,
        }, {
            pid: 86,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
            launchToken: "other-launch",
        }]);

        const launch = launcher.start({
            cmdlet: "proton",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "/games/Beat Saber",
        }, snapshot!);
        await flushPromises();

        expect(bsmSpawn).toHaveBeenCalledWith("proton", expect.objectContaining({
            options: expect.objectContaining({
                env: expect.objectContaining({ BSMANAGER_LAUNCH_TOKEN: snapshot!.launchToken }),
            }),
            flatpak: expect.objectContaining({
                host: true,
                env: expect.arrayContaining(["BSMANAGER_LAUNCH_TOKEN"]),
            }),
        }));
        expect(getProcessesByName).toHaveBeenLastCalledWith("Beat Saber.exe", snapshot!.launchToken);
        await expect(launch.ownership).resolves.toMatchObject({ pid: 85 });
        expect(app.quit).toHaveBeenCalledTimes(1);

        wrapper.emit("exit", 0);
        await expect(launch.exit).resolves.toBe(0);
    });

    it("keeps snapshot-failure fallback unowned under Flatpak", async () => {
        const wrapper = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (getProcessesByName as jest.Mock).mockRejectedValue(new Error("host ps failed"));
        const launcher = new TestLauncher();

        const snapshotPromise = launcher.snapshot();
        await jest.advanceTimersByTimeAsync(5_000);
        const snapshot = await snapshotPromise;
        expect(snapshot).toBeUndefined();
        const launch = launcher.start({
            cmdlet: "proton",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "/games/Beat Saber",
        }, snapshot);

        expect((bsmSpawn as jest.Mock).mock.calls[0][1].options.env).not.toHaveProperty("BSMANAGER_LAUNCH_TOKEN");
        await expect(launch.ownership).resolves.toBeUndefined();
        expect(app.quit).not.toHaveBeenCalled();
        expect(getProcessesByName).toHaveBeenCalledTimes(3);

        wrapper.emit("exit", 0);
        await expect(launch.exit).resolves.toBe(0);
    });

    it("does not claim pre-existing or concurrent host processes", async () => {
        const wrapper = childProcess();
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (getProcessesByName as jest.Mock).mockResolvedValueOnce([{
            pid: 85,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc",
            startTime: new Date("2026-07-13T07:59:59.000Z"),
        }]);
        const launcher = new TestLauncher();
        const snapshot = await launcher.snapshot();
        expect(snapshot).toBeDefined();
        (getProcessesByName as jest.Mock).mockResolvedValue([{
            pid: 85,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc",
            startTime: new Date("2026-07-13T07:59:59.000Z"),
            launchToken: snapshot!.launchToken,
        }, {
            pid: 86,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
            launchToken: "concurrent-launch",
        }]);

        const launch = launcher.start({
            cmdlet: "proton",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "/games/Beat Saber",
        }, snapshot);
        await jest.advanceTimersByTimeAsync(60_000);

        await expect(launch.ownership).resolves.toBeUndefined();
        expect(app.quit).not.toHaveBeenCalled();

        wrapper.emit("exit", 0);
        await expect(launch.exit).resolves.toBe(0);
    });
});
