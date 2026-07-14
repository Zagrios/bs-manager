import { pathExists, removeSync } from "fs-extra";
import { lastValueFrom } from "rxjs";
import { SteamLauncherService } from "main/services/bs-launcher/steam-launcher.service";
import { LaunchOption } from "shared/models/bs-launch";
import { execFile, spawn } from "child_process";
import { EventEmitter } from "events";
import { bsmSpawn, getProcessesByName } from "main/helpers/os.helpers";
import { app } from "electron";
import path from "path";

jest.mock("child_process", () => ({
    ...jest.requireActual("child_process"),
    execFile: jest.fn(),
    spawn: jest.fn(),
}));

jest.mock("electron", () => ({
    app: {
        getPath: jest.fn(() => ""),
        on: jest.fn(),
        removeListener: jest.fn(),
        quit: jest.fn(),
    },
}));

jest.mock("electron-log", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock("fs-extra", () => ({
    pathExists: jest.fn(),
    removeSync: jest.fn(),
    rename: jest.fn(),
}));

jest.mock("main/constants", () => ({
    BS_APP_ID: "620980",
    BS_EXECUTABLE: "Beat Saber.exe",
    STEAMVR_APP_ID: "250820",
    IS_FLATPAK: false,
}));

jest.mock("main/services/steam.service", () => ({
    SteamService: { getInstance: jest.fn(() => ({})) },
}));

jest.mock("main/services/utils.service", () => ({
    UtilsService: { getInstance: jest.fn(() => ({})) },
}));

jest.mock("main/services/linux.service", () => ({
    LinuxService: { getInstance: jest.fn(() => ({})) },
}));

jest.mock("main/services/bs-local-version.service", () => ({
    BSLocalVersionService: { getInstance: jest.fn(() => ({})) },
}));

jest.mock("main/services/static-configuration.service", () => ({
    StaticConfigurationService: { getInstance: jest.fn(() => ({ get: jest.fn(() => false) })) },
}));

jest.mock("main/helpers/os.helpers", () => ({
    BsmShellLog: { Command: 1 },
    bsmSpawn: jest.fn(),
    getProcessesByName: jest.fn(),
}));

jest.mock("main/helpers/launchOptions.helper", () => ({
    parseLaunchOptions: jest.fn(() => ({
        env: {},
        cmdlet: "Beat Saber.exe",
        args: "",
    })),
}));

const originalPlatform = process.platform;
const originalSystemRoot = process.env.SystemRoot;
const launchedAfter = new Date("2026-07-13T08:00:00.000Z");
const processStartedAt = new Date("2026-07-13T08:00:00.001Z");
const launchOptions = {
    cmdlet: "Beat Saber.exe",
    env: {},
    customEnv: {},
    beatSaberFolderPath: "C:/Beat Saber",
};

beforeAll(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
    process.env.SystemRoot = "C:\\Windows";
});

afterAll(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: originalPlatform });
    if (originalSystemRoot === undefined) {
        delete process.env.SystemRoot;
    } else {
        process.env.SystemRoot = originalSystemRoot;
    }
});

function processHandle(pid: number) {
    return Object.assign(new EventEmitter(), {
        exitCode: null,
        killed: false,
        pid,
        stdout: Object.assign(new EventEmitter(), { destroy: jest.fn() }),
        kill: jest.fn(),
        unref: jest.fn(),
    });
}

function reportElevatedHelperPid(process: ReturnType<typeof processHandle>, pid = 42): void {
    process.stdout.emit("data", Buffer.from(`BSM_ADMIN_HELPER_PID:${pid}\n`, "utf8"));
}

function serviceWithConfig(closeOnLaunch = false): SteamLauncherService {
    const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
    Object.assign(service as any, {
        staticConfig: { get: jest.fn(() => closeOnLaunch) },
        steam: { getGameFolder: jest.fn().mockResolvedValue(undefined) },
        util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
    });
    return service;
}

async function flushPromises(): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt++) {
        await Promise.resolve();
    }
}

async function currentWillQuitHandler(): Promise<(event: { preventDefault: jest.Mock }) => Promise<void>> {
    for (let attempt = 0; attempt < 20; attempt++) {
        const handler = (app.on as jest.Mock).mock.calls.find(([event]) => event === "will-quit")?.[1];
        if (handler) {
            return handler;
        }
        await Promise.resolve();
    }
    throw new Error("will-quit handler was not registered");
}

beforeEach(() => {
    jest.clearAllMocks();
    (pathExists as jest.Mock).mockResolvedValue(false);
    (removeSync as jest.Mock).mockReturnValue(undefined);
    (getProcessesByName as jest.Mock).mockResolvedValue([]);
});

afterEach(() => {
    jest.useRealTimers();
});

describe("SteamLauncherService legacy launch options", () => {
    function buildService(completion = { exitCode: 0, steamVrRestoreSafe: true }) {
        const service = serviceWithConfig();
        const steam = {
            isSteamRunning: jest.fn(async () => false),
            openSteam: jest.fn(async (): Promise<void> => undefined),
            getSteamPath: jest.fn(async () => "C:/Steam"),
        };

        Object.assign(service as any, {
            steam,
            localVersions: { getInstalledVersionPath: jest.fn(async () => "C:/Beat Saber") },
            linux: {
                buildEnvVariables: jest.fn(async () => ({})),
                getProtonPrefix: jest.fn(async () => "proton"),
            },
            backupSteamVR: jest.fn().mockResolvedValue(false),
            restoreSteamVR: jest.fn(async (): Promise<void> => undefined),
            launchBeatSaberNormally: jest.fn().mockResolvedValue(completion),
        });

        return { service, steam };
    }

    it("does not open Steam for a legacy skip_steam launch option", async () => {
        (pathExists as jest.Mock).mockResolvedValue(true);
        const { service, steam } = buildService();
        const options: LaunchOption = {
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: ["skip_steam"] as LaunchOption["launchMods"],
        };

        await lastValueFrom(service.launch(options));

        expect(steam.isSteamRunning).not.toHaveBeenCalled();
        expect(steam.openSteam).not.toHaveBeenCalled();
    });

    it("uses an explicit Linux environment builder when Linux is simulated", async () => {
        Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
        try {
            (pathExists as jest.Mock).mockResolvedValue(true);
            const { service } = buildService();
            const options: LaunchOption = {
                version: { BSVersion: "1.29.1", steam: true },
                launchMods: ["skip_steam"] as LaunchOption["launchMods"],
            };

            await lastValueFrom(service.launch(options));

            expect((service as any).linux.buildEnvVariables).toHaveBeenCalledWith(
                options,
                "C:/Steam",
                "C:/Beat Saber"
            );
        } finally {
            Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
        }
    });

    it.each([
        [{ exitCode: 0, steamVrRestoreSafe: true }, 1],
        [{ exitCode: 0, steamVrRestoreSafe: false }, 0],
    ])("restores SteamVR only after safely completed ownership", async (completion, restoreCalls) => {
        (pathExists as jest.Mock).mockResolvedValue(true);
        const { service } = buildService(completion);
        const options: LaunchOption = {
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"],
        };

        await lastValueFrom(service.launch(options));

        expect((service as any).restoreSteamVR).toHaveBeenCalledTimes(restoreCalls);
    });

    it("restores the FPFC backup when normal spawn fails before a process starts", async () => {
        (pathExists as jest.Mock).mockResolvedValue(true);
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        const { service } = buildService();
        delete (service as any).launchBeatSaberNormally;
        const options: LaunchOption = {
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"],
        };

        const launch = lastValueFrom(service.launch(options));
        await flushPromises();
        wrapper.emit("error", new Error("spawn failed"));

        await expect(launch).rejects.toThrow("spawn failed");
        expect((service as any).restoreSteamVR).toHaveBeenCalledTimes(1);
    });

    it("restores the FPFC backup when UAC rejects before the elevated helper starts", async () => {
        (pathExists as jest.Mock).mockResolvedValue(true);
        const elevationProcess = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(elevationProcess);
        const { service } = buildService();
        const options: LaunchOption = {
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"],
            admin: true,
        };

        const launch = lastValueFrom(service.launch(options));
        await flushPromises();
        elevationProcess.emit("exit", 1223);
        elevationProcess.emit("close", 1223);

        await expect(launch).rejects.toThrow("exited before reporting the helper PID");
        expect((service as any).restoreSteamVR).toHaveBeenCalledTimes(1);
    });

    it("restores the FPFC backup when elevation stdout ends before UAC rejection exits", async () => {
        (pathExists as jest.Mock).mockResolvedValue(true);
        const elevationProcess = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(elevationProcess);
        const { service } = buildService();
        const options: LaunchOption = {
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"],
            admin: true,
        };

        const launch = lastValueFrom(service.launch(options));
        await flushPromises();
        elevationProcess.stdout.emit("end");
        elevationProcess.emit("exit", 1223);
        elevationProcess.emit("close", 1223);

        await expect(launch).rejects.toThrow("exited before reporting the helper PID");
        expect((service as any).restoreSteamVR).toHaveBeenCalledTimes(1);
    });

    it("does not restore after an elevation error once the helper may have started Beat Saber", async () => {
        (pathExists as jest.Mock).mockResolvedValue(true);
        const elevationProcess = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(elevationProcess);
        const { service } = buildService();
        const options: LaunchOption = {
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"],
            admin: true,
        };

        const launch = lastValueFrom(service.launch(options));
        await flushPromises();
        reportElevatedHelperPid(elevationProcess, 84);
        await flushPromises();
        elevationProcess.emit("error", new Error("elevation channel failed"));

        await expect(launch).rejects.toThrow("elevation channel failed");
        expect((service as any).restoreSteamVR).not.toHaveBeenCalled();
    });

    it("hands normal ownership to the watcher before propagating an exit enumeration failure", async () => {
        (pathExists as jest.Mock).mockResolvedValue(true);
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        const { service } = buildService();
        delete (service as any).launchBeatSaberNormally;
        jest.spyOn(service as any, "findOwnedProcess").mockResolvedValue({
            pid: 85,
            startedAt: processStartedAt,
        });
        let lifecycleSignal: AbortSignal | undefined;
        jest.spyOn(service as any, "waitForOwnedProcessExit").mockImplementation(
            (...args: unknown[]) => {
                lifecycleSignal = args[2] as AbortSignal;
                return Promise.reject(new Error("monitor failed"));
            }
        );
        const handoffSteamVRRestore = jest.fn().mockResolvedValue(undefined);
        (service as any).handoffSteamVRRestore = handoffSteamVRRestore;
        const options: LaunchOption = {
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"],
        };

        const launch = lastValueFrom(service.launch(options));
        const rejection = launch.catch(error => error);
        const handler = await currentWillQuitHandler();

        await expect(rejection).resolves.toThrow("monitor failed");
        expect(handoffSteamVRRestore).toHaveBeenCalledWith(
            path.join("C:/Beat Saber", "Beat Saber.exe"),
            { pid: 85, startedAt: processStartedAt }
        );
        expect((service as any).restoreSteamVR).not.toHaveBeenCalled();
        expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);
        expect(lifecycleSignal?.aborted).toBe(true);
    });
});

describe("SteamLauncherService ownership evidence", () => {
    it("does not claim one concurrent manual process without wrapper provenance", () => {
        const service = serviceWithConfig();

        const selected = (service as any).selectOwnedProcess([{
            pid: 85,
            ppid: 77,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
            startTime: processStartedAt,
        }], new Set(), "C:/Beat Saber/Beat Saber.exe", launchedAfter, 42);

        expect(selected).toBeUndefined();
    });

    it("accepts an elevated child with unavailable path only with exact parent provenance", () => {
        const service = serviceWithConfig();
        const child = {
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            startTime: processStartedAt,
        };

        expect((service as any).selectOwnedProcess(
            [child], new Set(), "C:/Beat Saber/Beat Saber.exe", launchedAfter, 42
        )?.pid).toBe(85);
        expect((service as any).selectOwnedProcess(
            [child], new Set(), "C:/Beat Saber/Beat Saber.exe", launchedAfter, 77
        )).toBeUndefined();
    });

    it("requires exact executable path, process name, PID, and start-time evidence", () => {
        const service = serviceWithConfig();
        const valid = {
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "\"C:/Beat Saber/Beat Saber.exe\" fpfc",
            startTime: processStartedAt,
        };

        expect((service as any).processTargetsExecutable(
            valid, "C:/Beat Saber/Beat Saber.exe", launchedAfter
        )).toBe(true);
        expect((service as any).processTargetsExecutable(
            { ...valid, pid: 0 }, "C:/Beat Saber/Beat Saber.exe", launchedAfter
        )).toBe(false);
        expect((service as any).processTargetsExecutable(
            { ...valid, name: "Other.exe" }, "C:/Beat Saber/Beat Saber.exe", launchedAfter
        )).toBe(false);
        expect((service as any).processTargetsExecutable(
            { ...valid, cmd: "C:/Other Copy/Beat Saber.exe" }, "C:/Beat Saber/Beat Saber.exe", launchedAfter
        )).toBe(false);
        expect((service as any).processTargetsExecutable(
            { ...valid, startTime: new Date(launchedAfter.getTime() - 1) }, "C:/Beat Saber/Beat Saber.exe", launchedAfter
        )).toBe(false);
    });

    it("cancels a pending bounded process enumeration without stale acquisition", async () => {
        const service = serviceWithConfig();
        const controller = new AbortController();
        (getProcessesByName as jest.Mock).mockReturnValue(new Promise(() => {
            // Remains pending until ownership cancellation.
        }));

        const ownership = (service as any).findOwnedProcess(
            new Set(),
            "C:/Beat Saber/Beat Saber.exe",
            launchedAfter,
            42,
            controller.signal
        );
        controller.abort();

        await expect(ownership).resolves.toBeUndefined();
    });
});

describe("SteamLauncherService normal lifecycle", () => {
    it("does not claim Linux SteamVR restoration safety from wrapper exit alone", async () => {
        Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
        try {
            const wrapper = processHandle(42);
            (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
            const service = serviceWithConfig();
            jest.spyOn(service as any, "createProcessOwnershipSnapshot").mockResolvedValue({
                existingProcessIds: new Set([70]),
                launchedAfter,
            });
            let resolveOwnership: (ownedProcess: undefined) => void;
            jest.spyOn(service as any, "findOwnedProcess").mockReturnValue(new Promise(resolve => {
                resolveOwnership = resolve;
            }));

            let settled = false;
            const launch = (service as any).launchBeatSaberNormally({
                ...launchOptions,
                beatSaberFolderPath: "/games/Beat Saber",
            }).then((completion: unknown) => {
                settled = true;
                return completion;
            });
            await flushPromises();
            wrapper.emit("exit", 7);
            await flushPromises();

            expect(settled).toBe(false);

            resolveOwnership!(undefined);
            await expect(launch).resolves.toEqual({ exitCode: 7, steamVrRestoreSafe: false });
        } finally {
            Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
        }
    });

    it("restores SteamVR before completing an exactly owned Linux auto-close quit", async () => {
        Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
        try {
            const wrapper = processHandle(42);
            (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
            const owned = {
                pid: 85,
                ppid: 42,
                name: "Beat Saber.exe",
                cmd: '"Z:C:/Beat Saber/Beat Saber.exe"',
                startTime: processStartedAt,
            };
            (getProcessesByName as jest.Mock).mockResolvedValue([owned]);
            const service = serviceWithConfig(true);
            let finishRestore!: () => void;
            let restoreFinished = false;
            const restoreSteamVR = jest.fn(() => new Promise<void>(resolve => {
                finishRestore = () => {
                    restoreFinished = true;
                    resolve();
                };
            }));
            (service as any).restoreSteamVR = restoreSteamVR;
            let launchCompleted = false;

            const launch = (service as any).launchTrackedBeatSaber({
                ...launchOptions,
                beatSaberFolderPath: "C:/Beat Saber",
            }, {
                existingProcessIds: new Set(),
                launchedAfter,
            }).then((completion: unknown) => {
                launchCompleted = true;
                return completion;
            });
            await flushPromises();

            expect(app.quit).toHaveBeenCalledTimes(1);
            const handler = await currentWillQuitHandler();
            (app.quit as jest.Mock).mockClear();
            const event = { preventDefault: jest.fn() };
            let quitCompleted = false;
            const handlingQuit = handler(event).then(() => {
                quitCompleted = true;
            });
            await flushPromises();

            expect(event.preventDefault).toHaveBeenCalledTimes(1);
            expect(restoreSteamVR).toHaveBeenCalledTimes(1);
            expect(quitCompleted).toBe(false);
            expect(launchCompleted).toBe(false);
            expect(app.removeListener).not.toHaveBeenCalledWith("will-quit", handler);
            expect(wrapper.unref).not.toHaveBeenCalled();
            expect(app.quit).not.toHaveBeenCalled();

            finishRestore();
            await handlingQuit;

            expect(restoreFinished).toBe(true);
            expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);
            expect(wrapper.unref).toHaveBeenCalledTimes(1);
            expect(app.quit).toHaveBeenCalledTimes(1);
            await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: false });
        } finally {
            Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
        }
    });

    it("continues bounded ownership after a nonzero wrapper exit without premature restore or close", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        (pathExists as jest.Mock).mockResolvedValue(true);
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        let resolveOwnership: (processes: unknown[]) => void;
        const ownership = new Promise<unknown[]>(resolve => {
            resolveOwnership = resolve;
        });
        const owned = {
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
            startTime: processStartedAt,
        };
        const concurrent = {
            ...owned,
            pid: 86,
            ppid: 77,
        };
        (getProcessesByName as jest.Mock)
            .mockResolvedValueOnce([])
            .mockReturnValueOnce(ownership)
            .mockResolvedValueOnce([owned, concurrent])
            .mockResolvedValueOnce([concurrent]);
        const { service } = (() => {
            const built = serviceWithConfig(true);
            Object.assign(built as any, {
                steam: {
                    isSteamRunning: jest.fn(async () => true),
                    getSteamPath: jest.fn(async () => "C:/Steam"),
                    getGameFolder: jest.fn().mockResolvedValue(undefined),
                },
                localVersions: { getInstalledVersionPath: jest.fn(async () => "C:/Beat Saber") },
                backupSteamVR: jest.fn().mockResolvedValue(false),
                restoreSteamVR: jest.fn(async (): Promise<void> => undefined),
            });
            return { service: built };
        })();
        const options: LaunchOption = {
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"],
        };

        const launch = lastValueFrom(service.launch(options));
        await flushPromises();
        wrapper.emit("exit", 7);
        await flushPromises();

        expect((service as any).restoreSteamVR).not.toHaveBeenCalled();
        expect(app.quit).not.toHaveBeenCalled();

        resolveOwnership!([owned, concurrent]);
        await flushPromises();

        expect(app.quit).toHaveBeenCalledTimes(1);
        expect((service as any).restoreSteamVR).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1_000);
        await launch;
        expect((service as any).restoreSteamVR).toHaveBeenCalledTimes(1);
    });

    it("waits for delayed ownership after a successful wrapper exit before restoring SteamVR", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        (pathExists as jest.Mock).mockResolvedValue(true);
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        const owned = {
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
            startTime: processStartedAt,
        };
        (getProcessesByName as jest.Mock).mockImplementation(() => Promise.resolve(
            Date.now() >= launchedAfter.getTime() + 6_000 ? [owned] : []
        ));
        const service = serviceWithConfig(true);
        Object.assign(service as any, {
            restoreSteamVR: jest.fn(async (): Promise<void> => undefined),
        });

        const launch = (service as any).launchTrackedBeatSaber(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter,
        });
        wrapper.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(5_000);

        expect((service as any).restoreSteamVR).not.toHaveBeenCalled();
        expect(app.quit).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1_000);
        expect(app.quit).toHaveBeenCalledTimes(1);
        expect((service as any).restoreSteamVR).not.toHaveBeenCalled();

        (getProcessesByName as jest.Mock).mockResolvedValue([]);
        await jest.advanceTimersByTimeAsync(1_000);
        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: true });
    });

    it("does not claim SteamVR restoration safety from an early wrapper success plus acquisition timeout", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (getProcessesByName as jest.Mock).mockResolvedValue([]);
        const service = serviceWithConfig();

        const launch = (service as any).launchTrackedBeatSaber(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter,
        });
        wrapper.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(60_000);

        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: false });
    });

    it("launches normally when the optional ownership snapshot fails", async () => {
        jest.useFakeTimers();
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (getProcessesByName as jest.Mock).mockRejectedValue(new Error("process list unavailable"));
        const service = serviceWithConfig();

        const launch = (service as any).launchBeatSaberNormally(launchOptions);
        await jest.advanceTimersByTimeAsync(500);

        expect(bsmSpawn).toHaveBeenCalledTimes(1);
        wrapper.emit("exit", 0);
        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: false });
    });

    it("does not prevent quit while normal-launch ownership is missing", async () => {
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (getProcessesByName as jest.Mock).mockReturnValue(new Promise(() => {
            // Remains pending until ownership cancellation.
        }));
        const service = serviceWithConfig();
        const launch = (service as any).launchTrackedBeatSaber(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter,
        });
        const handler = await currentWillQuitHandler();
        const event = { preventDefault: jest.fn() };

        await handler(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(wrapper.unref).toHaveBeenCalledTimes(1);
        expect(app.quit).not.toHaveBeenCalled();
        expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);

        wrapper.emit("exit", 0);
        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: false });
    });

    it("auto-closes a safely owned normal launch without any focus action", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        const owned = {
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
            startTime: processStartedAt,
        };
        (getProcessesByName as jest.Mock)
            .mockResolvedValueOnce([owned])
            .mockResolvedValueOnce([owned])
            .mockResolvedValue([]);
        const service = serviceWithConfig(true);

        const launch = (service as any).launchTrackedBeatSaber(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter,
        });
        await flushPromises();

        expect(execFile).not.toHaveBeenCalled();
        expect(app.quit).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1_000);
        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: true });
    });

    it("completes a normal quit that overlaps a monitoring-failure handoff", async () => {
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        const service = serviceWithConfig();
        jest.spyOn(service as any, "findOwnedProcess").mockResolvedValue({
            pid: 85,
            startedAt: processStartedAt,
        });
        jest.spyOn(service as any, "waitForOwnedProcessExit").mockRejectedValue(new Error("monitor failed"));
        let resolveHandoff!: () => void;
        const handoff = new Promise<void>(resolve => {
            resolveHandoff = resolve;
        });
        (service as any).handoffSteamVRRestore = jest.fn(() => handoff);

        const launch = (service as any).launchTrackedBeatSaber(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter,
        });
        const rejection = launch.catch((error: Error) => error);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        const event = { preventDefault: jest.fn() };
        const quit = handler(event);
        resolveHandoff();
        await quit;

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(app.quit).toHaveBeenCalledTimes(1);
        await expect(rejection).resolves.toThrow("monitor failed");
    });

    it("performs no focus or close action when wrapper failure cancels ownership", async () => {
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (getProcessesByName as jest.Mock).mockReturnValue(new Promise(() => {
            // Remains pending until ownership cancellation.
        }));
        const service = serviceWithConfig(true);

        const launch = (service as any).launchTrackedBeatSaber(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter,
        });
        wrapper.emit("error", new Error("spawn failed"));

        await expect(launch).rejects.toThrow("spawn failed");
        expect(execFile).not.toHaveBeenCalled();
        expect(app.quit).not.toHaveBeenCalled();
    });

    it("bounds the complete owned-process quit preflight when SteamVR path discovery hangs", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        const owned = {
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
            startTime: processStartedAt,
        };
        (getProcessesByName as jest.Mock).mockResolvedValue([owned]);
        const service = serviceWithConfig(true);
        (service as any).steam = {
            getGameFolder: jest.fn(() => new Promise(() => {
                // A stalled Steam lookup must not keep will-quit prevented forever.
            })),
        };

        const launch = (service as any).launchTrackedBeatSaber(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter,
        });
        await flushPromises();
        const handler = await currentWillQuitHandler();
        (app.quit as jest.Mock).mockClear();
        const event = { preventDefault: jest.fn() };
        const handlingQuit = handler(event);

        await jest.advanceTimersByTimeAsync(10_000);
        await handlingQuit;

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);
        expect(wrapper.unref).toHaveBeenCalledTimes(1);
        expect(app.quit).toHaveBeenCalledTimes(1);
        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: false });
    });

    it("bounds Linux SteamVR restoration during will-quit", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
        try {
            const wrapper = processHandle(42);
            (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
            const service = serviceWithConfig(true);
            jest.spyOn(service as any, "findOwnedProcess").mockResolvedValue({
                pid: 85,
                startedAt: processStartedAt,
            });
            jest.spyOn(service as any, "waitForOwnedProcessExit").mockImplementation((...args: unknown[]) => {
                const signal = args[2] as AbortSignal;
                return new Promise<boolean>(resolve => {
                    signal.addEventListener("abort", () => resolve(false), { once: true });
                });
            });
            jest.spyOn(service, "restoreSteamVR").mockReturnValue(new Promise(() => {
                // A stalled Linux restore must not keep will-quit prevented forever.
            }));

            const launch = (service as any).launchTrackedBeatSaber(launchOptions, {
                existingProcessIds: new Set(),
                launchedAfter,
            });
            await flushPromises();
            const handler = await currentWillQuitHandler();
            (app.quit as jest.Mock).mockClear();
            const event = { preventDefault: jest.fn() };
            const handlingQuit = handler(event);

            await jest.advanceTimersByTimeAsync(7_500);
            await handlingQuit;

            expect(event.preventDefault).toHaveBeenCalledTimes(1);
            expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);
            expect(wrapper.unref).toHaveBeenCalledTimes(1);
            expect(app.quit).toHaveBeenCalledTimes(1);
            await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: false });
        } finally {
            Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
        }
    });
});

describe("SteamLauncherService elevated lifecycle", () => {
    it("accepts a helper PID delivered by stdout after the elevation process exit event", async () => {
        const elevationProcess = processHandle(42);
        const service = serviceWithConfig();

        const helperPid = (service as any).waitForElevatedHelperPid(elevationProcess);
        const outcome = helperPid.then(
            (pid: number) => ({ pid }),
            (error: Error) => ({ error })
        );
        elevationProcess.emit("exit", 0);
        elevationProcess.stdout.emit("data", Buffer.from("BSM_ADMIN_HELPER_PID:84\n", "utf8"));
        elevationProcess.stdout.emit("end");

        await expect(outcome).resolves.toEqual({ pid: 84 });
    });

    it("elevates with shell-free PowerShell and owns only the reported helper's child", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        const elevationProcess = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(elevationProcess);
        (getProcessesByName as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{
                pid: 85,
                ppid: 42,
                name: "Beat Saber.exe",
                startTime: processStartedAt,
            }, {
                pid: 86,
                ppid: 84,
                name: "Beat Saber.exe",
                startTime: processStartedAt,
            }])
            .mockResolvedValueOnce([]);
        const service = serviceWithConfig();
        const waitForOwnedProcessExit = jest.spyOn(service as any, "waitForOwnedProcessExit")
            .mockResolvedValue(true);

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", ["fpfc"], {});
        await flushPromises();
        reportElevatedHelperPid(elevationProcess, 84);
        await flushPromises();
        elevationProcess.emit("exit", 0);

        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: true });
        expect(spawn).toHaveBeenCalledWith(
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            expect.any(Array),
            expect.objectContaining({ detached: true, shell: false })
        );
        const encodedScript = (spawn as jest.Mock).mock.calls[0][1][3];
        const script = Buffer.from(encodedScript, "base64").toString("utf16le");
        expect(script).toContain("Start-Process");
        expect(script).toContain("-Verb RunAs");
        expect(script).toContain("FromBase64String");
        expect(script).not.toContain("C:/Beat Saber/Beat Saber.exe");
        expect(script).not.toContain("C:\\assets\\scripts\\start_beat_saber_admin.exe");
        expect(waitForOwnedProcessExit).toHaveBeenCalledWith(
            "C:/Beat Saber/Beat Saber.exe",
            { pid: 86, startedAt: processStartedAt },
            expect.any(AbortSignal)
        );
    });

    it("bounds helper PID acquisition and detaches unresolved PowerShell safely", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        const elevationProcess = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(elevationProcess);
        const service = serviceWithConfig();

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        const failure = launch.catch((error: Error & { steamVrRestoreSafe?: boolean }) => error);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        await jest.advanceTimersByTimeAsync(60_000);

        await expect(failure).resolves.toMatchObject({
            message: "Elevated helper PID acquisition timed out",
            steamVrRestoreSafe: false,
        });
        expect(elevationProcess.unref).toHaveBeenCalledTimes(1);
        expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);
    });

    it("continues elevated ownership proof after a nonzero helper result", async () => {
        const elevationProcess = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(elevationProcess);
        const service = serviceWithConfig();
        let resolveOwnership: (ownedProcess: undefined) => void;
        jest.spyOn(service as any, "findOwnedProcess").mockReturnValue(new Promise(resolve => {
            resolveOwnership = resolve;
        }));

        let settled = false;
        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {})
            .then((completion: unknown) => {
                settled = true;
                return completion;
            });
        await flushPromises();
        reportElevatedHelperPid(elevationProcess, 84);
        await flushPromises();
        elevationProcess.emit("exit", 7);
        await flushPromises();

        expect(settled).toBe(false);

        resolveOwnership!(undefined);
        await expect(launch).resolves.toEqual({
            exitCode: 7,
            steamVrRestoreSafe: false,
        });
    });

    it("keeps one will-quit listener continuously across helper exit and ownership acquisition", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        let resolveOwnership: (value: unknown[]) => void;
        const ownership = new Promise<unknown[]>(resolve => {
            resolveOwnership = resolve;
        });
        (getProcessesByName as jest.Mock)
            .mockResolvedValueOnce([])
            .mockReturnValueOnce(ownership)
            .mockResolvedValue([]);
        const service = serviceWithConfig();

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await flushPromises();
        reportElevatedHelperPid(helper);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        helper.emit("exit", 0);
        await flushPromises();

        expect(app.removeListener).not.toHaveBeenCalledWith("will-quit", handler);

        resolveOwnership!([]);
        await jest.advanceTimersByTimeAsync(60_000);
        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: false });
    });

    it("does not intercept quit or hand off when elevated ownership is not established", async () => {
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        (getProcessesByName as jest.Mock)
            .mockResolvedValueOnce([])
            .mockReturnValue(new Promise(() => {
                // Remains pending until ownership cancellation.
            }));
        const service = serviceWithConfig();
        const handoffSteamVRRestore = jest.fn();
        (service as any).handoffSteamVRRestore = handoffSteamVRRestore;

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await flushPromises();
        reportElevatedHelperPid(helper);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        const event = { preventDefault: jest.fn() };

        await handler(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(handoffSteamVRRestore).not.toHaveBeenCalled();
        expect(helper.unref).toHaveBeenCalledTimes(1);
        expect(app.quit).not.toHaveBeenCalled();

        helper.emit("exit", 0);
        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: false });
    });

    it("auto-closes a safely owned elevated process with unavailable path and no focus action", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        const owned = {
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            startTime: processStartedAt,
        };
        (getProcessesByName as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([owned])
            .mockResolvedValueOnce([owned])
            .mockResolvedValue([]);
        const service = serviceWithConfig(true);

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await flushPromises();
        reportElevatedHelperPid(helper);
        await flushPromises();
        helper.emit("exit", 0);
        await flushPromises();

        expect(execFile).not.toHaveBeenCalled();
        expect(app.quit).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1_000);
        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: true });
    });

    it("reports an elevated watcher handoff failure and still cleans the lifecycle", async () => {
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        const service = serviceWithConfig();
        jest.spyOn(service as any, "findOwnedProcess").mockResolvedValue({
            pid: 85,
            startedAt: processStartedAt,
        });
        let lifecycleSignal: AbortSignal | undefined;
        jest.spyOn(service as any, "waitForOwnedProcessExit").mockImplementation(
            (...args: unknown[]) => {
                lifecycleSignal = args[2] as AbortSignal;
                return Promise.reject(new Error("monitor failed"));
            }
        );
        const handoffSteamVRRestore = jest.fn().mockRejectedValue(new Error("watcher unavailable"));
        (service as any).handoffSteamVRRestore = handoffSteamVRRestore;

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        const rejection = launch.catch((error: Error) => error);
        await flushPromises();
        reportElevatedHelperPid(helper, 84);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        helper.emit("exit", 0);

        await expect(rejection).resolves.toMatchObject({
            message: "Owned Beat Saber exit monitoring failed and SteamVR restore watcher handoff failed",
            steamVrRestoreSafe: false,
        });
        expect(handoffSteamVRRestore).toHaveBeenCalledWith(
            "C:/Beat Saber/Beat Saber.exe",
            { pid: 85, startedAt: processStartedAt }
        );
        expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);
        expect(lifecycleSignal?.aborted).toBe(true);
    });

    it("completes an elevated quit that overlaps a monitoring-failure handoff", async () => {
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        const service = serviceWithConfig();
        jest.spyOn(service as any, "findOwnedProcess").mockResolvedValue({
            pid: 85,
            startedAt: processStartedAt,
        });
        jest.spyOn(service as any, "waitForOwnedProcessExit").mockRejectedValue(new Error("monitor failed"));
        let resolveHandoff!: () => void;
        const handoff = new Promise<void>(resolve => {
            resolveHandoff = resolve;
        });
        (service as any).handoffSteamVRRestore = jest.fn(() => handoff);

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        const rejection = launch.catch((error: Error) => error);
        await flushPromises();
        reportElevatedHelperPid(helper, 84);
        await flushPromises();
        helper.emit("exit", 0);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        const event = { preventDefault: jest.fn() };
        const quit = handler(event);
        resolveHandoff();
        await quit;

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(app.quit).toHaveBeenCalledTimes(1);
        await expect(rejection).resolves.toThrow("monitor failed");
    });

    it("bounds the elevated owned-process quit preflight and still completes quit", async () => {
        jest.useFakeTimers({ now: launchedAfter });
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        const service = serviceWithConfig();
        jest.spyOn(service as any, "findOwnedProcess").mockResolvedValue({
            pid: 85,
            startedAt: processStartedAt,
        });
        jest.spyOn(service as any, "waitForOwnedProcessExit").mockReturnValue(new Promise(() => {
            // The owned process remains alive while the app is quitting.
        }));
        (service as any).steam = { getGameFolder: jest.fn(() => new Promise(() => {
            // Simulate an unbounded Steam path lookup.
        })) };

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        expect(launch).toBeInstanceOf(Promise);
        await flushPromises();
        reportElevatedHelperPid(helper, 84);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        const event = { preventDefault: jest.fn() };

        const quit = handler(event);
        await jest.advanceTimersByTimeAsync(7_500);
        await quit;

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);
        expect(helper.unref).toHaveBeenCalledTimes(1);
        expect(app.quit).toHaveBeenCalledTimes(1);
    });

    it.each([false, true])("always completes quit after owned SteamVR handoff (failure=%s)", async handoffFails => {
        jest.useFakeTimers({ now: launchedAfter });
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        const owned = {
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
            startTime: processStartedAt,
        };
        (getProcessesByName as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValue([owned]);
        const service = serviceWithConfig();
        const handoffSteamVRRestore = handoffFails
            ? jest.fn().mockRejectedValue(new Error("watcher unavailable"))
            : jest.fn().mockResolvedValue(undefined);
        (service as any).handoffSteamVRRestore = handoffSteamVRRestore;

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await flushPromises();
        reportElevatedHelperPid(helper);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        helper.emit("exit", 0);
        await flushPromises();
        const event = { preventDefault: jest.fn() };

        await handler(event);

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(handoffSteamVRRestore).toHaveBeenCalledWith(
            "C:/Beat Saber/Beat Saber.exe",
            { pid: 85, startedAt: processStartedAt }
        );
        expect(helper.unref).toHaveBeenCalledTimes(1);
        expect(app.quit).toHaveBeenCalledTimes(1);

        await expect(launch).resolves.toEqual({ exitCode: 0, steamVrRestoreSafe: false });
    });
});

describe("SteamVR restore watcher", () => {
    it("reuses one target-process identity function for readiness and polling", async () => {
        const watcher = Object.assign(new EventEmitter(), { unref: jest.fn() });
        (spawn as jest.Mock).mockReturnValue(watcher);
        (pathExists as jest.Mock).mockImplementation(async filePath => (
            String(filePath).endsWith(".bak") || String(filePath).endsWith(".ready")
        ));
        const service = serviceWithConfig();
        (service as any).steam = { getGameFolder: jest.fn().mockResolvedValue("C:/SteamVR") };

        await (service as any).handoffSteamVRRestore(
            "C:/Beat Saber/Beat Saber.exe",
            { pid: 85, startedAt: processStartedAt }
        );

        const encodedScript = (spawn as jest.Mock).mock.calls[0][1][3];
        const script = Buffer.from(encodedScript, "base64").toString("utf16le");
        expect(script).toContain("function Get-TargetProcessState");
        expect(script.match(/Get-Process -Id \$TargetProcessId/g)).toHaveLength(1);
        expect(script.match(/\$targetState = Get-TargetProcessState/g)).toHaveLength(2);
        expect(script).toContain("while ($targetState -eq 'Owned')");
        expect(script.match(/Get-TargetProcessState/g)).toHaveLength(3);
    });

    it("exits fail-closed without restoring when polling changes from Owned to Uncertain", async () => {
        const watcher = Object.assign(new EventEmitter(), { unref: jest.fn() });
        (spawn as jest.Mock).mockReturnValue(watcher);
        (pathExists as jest.Mock).mockImplementation(async filePath => (
            String(filePath).endsWith(".bak") || String(filePath).endsWith(".ready")
        ));
        const service = serviceWithConfig();
        (service as any).steam = { getGameFolder: jest.fn().mockResolvedValue("C:/SteamVR") };

        await (service as any).handoffSteamVRRestore(
            "C:/Beat Saber/Beat Saber.exe",
            { pid: 85, startedAt: processStartedAt }
        );

        const encodedScript = (spawn as jest.Mock).mock.calls[0][1][3];
        const script = Buffer.from(encodedScript, "base64").toString("utf16le");
        const polling = script.indexOf("while ($targetState -eq 'Owned')");
        const refresh = script.indexOf("$targetState = Get-TargetProcessState", polling + 1);
        const uncertainExit = script.indexOf("if ($targetState -eq 'Uncertain')", refresh + 1);
        const confirmedExit = script.indexOf("if ($targetState -ne 'Exited')", uncertainExit + 1);
        const restoreAttempt = script.indexOf("for ($attempt = 0; $attempt -lt 60; $attempt++)");

        expect(polling).toBeGreaterThan(-1);
        expect(refresh).toBeGreaterThan(polling);
        expect(uncertainExit).toBeGreaterThan(refresh);
        expect(script.slice(uncertainExit, confirmedExit)).toContain("exit 2");
        expect(confirmedExit).toBeGreaterThan(uncertainExit);
        expect(script.slice(confirmedExit, restoreAttempt)).toContain("exit 2");
        expect(restoreAttempt).toBeGreaterThan(confirmedExit);
    });

    it.each([
        ["absent", "if ($null -eq $processCandidate) {\n        return 'Exited'\n    }"],
        ["reused", "if (!$pathMatches -or !$startTimeMatches) {\n            return 'Exited'\n        }"],
    ])("treats an %s exact PID as an exited original without attaching to it", async (_state, expectedBranch) => {
        const watcher = Object.assign(new EventEmitter(), { unref: jest.fn() });
        (spawn as jest.Mock).mockReturnValue(watcher);
        (pathExists as jest.Mock).mockImplementation(async filePath => (
            String(filePath).endsWith(".bak") || String(filePath).endsWith(".ready")
        ));
        const service = serviceWithConfig();
        (service as any).steam = { getGameFolder: jest.fn().mockResolvedValue("C:/SteamVR") };

        await (service as any).handoffSteamVRRestore(
            "C:/Beat Saber/Beat Saber.exe",
            { pid: 85, startedAt: processStartedAt }
        );

        const encodedScript = (spawn as jest.Mock).mock.calls[0][1][3];
        const script = Buffer.from(encodedScript, "base64").toString("utf16le");
        expect(script).toContain(expectedBranch);
        expect(script).toContain("if ($targetState -eq 'Uncertain')");
        expect(script).toContain("if ($targetState -eq 'Owned')");
        expect(script.indexOf("WriteAllText($HandoffReadyPath")).toBeLessThan(
            script.indexOf("if ($targetState -eq 'Owned')")
        );
    });

    it("uses an absolute shell-free PowerShell process bound to exact owned identity", async () => {
        const watcher = Object.assign(new EventEmitter(), { unref: jest.fn() });
        (spawn as jest.Mock).mockReturnValue(watcher);
        (pathExists as jest.Mock).mockImplementation(async filePath => (
            String(filePath).endsWith(".bak") || String(filePath).endsWith(".ready")
        ));
        const service = serviceWithConfig();
        (service as any).steam = { getGameFolder: jest.fn().mockResolvedValue("C:/SteamVR") };

        await (service as any).handoffSteamVRRestore(
            "C:/Beat Saber/Beat Saber.exe",
            { pid: 85, startedAt: processStartedAt }
        );

        expect(spawn).toHaveBeenCalledWith(
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            expect.any(Array),
            expect.objectContaining({ detached: true, shell: false, stdio: "ignore" })
        );
        const encodedScript = (spawn as jest.Mock).mock.calls[0][1][3];
        const script = Buffer.from(encodedScript, "base64").toString("utf16le");
        expect(script).toContain("$TargetProcessId = 85");
        expect(script).toContain(`$TargetProcessStartedAtUtc = [DateTime]::Parse('${processStartedAt.toISOString()}').ToUniversalTime()`);
        expect(script).toContain("Get-Process -Id $TargetProcessId");
        expect(script).not.toContain("Get-Process -Name");
        expect(script).toContain("$pathMatches = $true");
        expect(script).toContain("if ($null -ne $processPath)");
        expect(watcher.unref).toHaveBeenCalledTimes(1);
        expect(removeSync).toHaveBeenCalledWith(expect.stringMatching(/\.ready$/));
    });

    it("rejects watcher failure without leaving readiness listeners or files stale", async () => {
        const watcher = Object.assign(new EventEmitter(), {
            kill: jest.fn(),
            killed: false,
            unref: jest.fn(),
        });
        (spawn as jest.Mock).mockReturnValue(watcher);
        (pathExists as jest.Mock).mockImplementation(async filePath => String(filePath).endsWith(".bak"));
        const service = serviceWithConfig();
        (service as any).steam = { getGameFolder: jest.fn().mockResolvedValue("C:/SteamVR") };

        const handoff = (service as any).handoffSteamVRRestore(
            "C:/Beat Saber/Beat Saber.exe",
            { pid: 85, startedAt: processStartedAt }
        );
        await flushPromises();
        watcher.emit("error", new Error("spawn failed"));

        await expect(handoff).rejects.toThrow("spawn failed");
        expect(watcher.listenerCount("error")).toBe(0);
        expect(watcher.listenerCount("exit")).toBe(0);
        expect(removeSync).toHaveBeenCalledWith(expect.stringMatching(/\.ready$/));
        expect(watcher.kill).toHaveBeenCalledTimes(1);
        expect(watcher.unref).toHaveBeenCalledTimes(1);
    });
});
