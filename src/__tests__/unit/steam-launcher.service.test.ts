import { pathExists } from "fs-extra";
import { lastValueFrom } from "rxjs";
import { SteamLauncherService } from "main/services/bs-launcher/steam-launcher.service";
import { LaunchOption } from "shared/models/bs-launch";
import { exec, spawn } from "child_process";
import { EventEmitter } from "events";
import { bsmSpawn, getProcessIds } from "main/helpers/os.helpers";
import { app } from "electron";

jest.mock("child_process", () => ({
    ...jest.requireActual("child_process"),
    exec: jest.fn(),
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

jest.mock("main/helpers/os.helpers", () => ({
    BsmShellLog: { Command: 1 },
    bsmSpawn: jest.fn(),
    getProcessIds: jest.fn(),
}));

jest.mock("main/helpers/launchOptions.helper", () => ({
    parseLaunchOptions: jest.fn(() => ({
        env: {},
        cmdlet: "Beat Saber.exe",
        args: "",
    })),
}));

describe("SteamLauncherService legacy launch options", () => {
    function buildService() {
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const steam = {
            isSteamRunning: jest.fn(async () => false),
            openSteam: jest.fn(async (): Promise<void> => undefined),
            getSteamPath: jest.fn(async () => "C:/Steam"),
        };

        (service as any).steam = steam;
        (service as any).localVersions = {
            getInstalledVersionPath: jest.fn(async () => "C:/Beat Saber"),
        };
        (service as any).linux = {
            buildEnvVariables: jest.fn(async () => ({})),
            getProtonPrefix: jest.fn(async () => "proton"),
        };
        (service as any).restoreSteamVR = jest.fn(async (): Promise<void> => undefined);
        (service as any).launchBeatSaber = jest.fn(() => ({
            process: {},
            exit: Promise.resolve(0),
        }));

        return { service, steam };
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (getProcessIds as jest.Mock).mockResolvedValue([]);
        (pathExists as jest.Mock).mockResolvedValue(true);
    });

    it("does not open Steam for a legacy skip_steam launch option", async () => {
        const { service, steam } = buildService();
        const launchOptions: LaunchOption = {
            version: {
                BSVersion: "1.29.1",
                steam: true,
            },
            launchMods: ["skip_steam"] as LaunchOption["launchMods"],
        };

        await lastValueFrom(service.launch(launchOptions));

        expect(steam.isSteamRunning).not.toHaveBeenCalled();
        expect(steam.openSteam).not.toHaveBeenCalled();
    });
});

describe("SteamLauncherService administrator lifecycle", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getProcessIds as jest.Mock).mockResolvedValue([]);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("hands off SteamVR restoration on quit until the owned Beat Saber process exits", async () => {
        const gameProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 42,
            unref: jest.fn(),
        });
        const restoreWatcher = Object.assign(new EventEmitter(), {
            unref: jest.fn(),
        });
        (bsmSpawn as jest.Mock).mockReturnValue(gameProcess);
        (spawn as jest.Mock).mockReturnValue(restoreWatcher);
        (pathExists as jest.Mock).mockResolvedValue(true);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const restoreSteamVR = jest.fn().mockResolvedValue(undefined);
        Object.assign(service as any, {
            steam: { getGameFolder: jest.fn().mockResolvedValue("C:/SteamVR") },
            restoreSteamVR,
            handleGameWindowReady: jest.fn(),
        });

        (service as any).launchBeatSaber({
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:/Beat Saber",
        });
        const willQuitHandler = (app.on as jest.Mock).mock.calls.find(([event]) => event === "will-quit")[1];
        const quitEvent = { preventDefault: jest.fn() };

        const handlingQuit = willQuitHandler(quitEvent);
        await Promise.resolve();
        await Promise.resolve();
        restoreWatcher.emit("spawn");
        await handlingQuit;

        const encodedScript = (spawn as jest.Mock).mock.calls[0]?.[1]?.[3];
        const script = encodedScript ? Buffer.from(encodedScript, "base64").toString("utf16le") : "";
        expect(script).toContain("$_.StartTime.ToUniversalTime() -ge $LaunchStartedAfterUtc");
        expect(script).toContain("$ownedProcessId");
        expect(script).toContain("if ($null -ne $ownedProcess) {");
        expect(script).not.toContain("if ($null -eq $ownedProcess) {\n    exit 2");
        expect(spawn).toHaveBeenCalledWith("powershell.exe", expect.any(Array), expect.objectContaining({
            detached: true,
            stdio: "ignore",
        }));
        expect(restoreSteamVR).not.toHaveBeenCalled();
        expect(gameProcess.unref).toHaveBeenCalled();
        expect(restoreWatcher.unref).toHaveBeenCalled();
        expect(app.quit).toHaveBeenCalled();
    });

    it("keeps launch ownership when the detached SteamVR restore watcher cannot start", async () => {
        const gameProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 42,
            unref: jest.fn(),
        });
        const restoreWatcher = Object.assign(new EventEmitter(), {
            unref: jest.fn(),
        });
        (bsmSpawn as jest.Mock).mockReturnValue(gameProcess);
        (spawn as jest.Mock).mockReturnValue(restoreWatcher);
        (pathExists as jest.Mock).mockResolvedValue(true);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const restoreSteamVR = jest.fn().mockResolvedValue(undefined);
        Object.assign(service as any, {
            steam: { getGameFolder: jest.fn().mockResolvedValue("C:/SteamVR") },
            restoreSteamVR,
            handleGameWindowReady: jest.fn(),
        });

        const { exit } = (service as any).launchBeatSaber({
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:/Beat Saber",
        });
        const willQuitHandler = (app.on as jest.Mock).mock.calls.find(([event]) => event === "will-quit")[1];
        const quitEvent = { preventDefault: jest.fn() };

        const handlingQuit = willQuitHandler(quitEvent);
        await Promise.resolve();
        await Promise.resolve();
        restoreWatcher.emit("error", new Error("spawn failed"));
        await handlingQuit;

        expect(quitEvent.preventDefault).toHaveBeenCalled();
        expect(gameProcess.unref).not.toHaveBeenCalled();
        expect(app.quit).not.toHaveBeenCalled();
        expect(restoreSteamVR).not.toHaveBeenCalled();

        gameProcess.emit("exit", 0);
        await expect(exit).resolves.toBe(0);
    });

    it("uses the same window-ready lifecycle for normal and elevated launches", async () => {
        const normalProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 42,
            unref: jest.fn(),
        });
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 84,
            unref: jest.fn(),
        });
        (bsmSpawn as jest.Mock).mockReturnValue(normalProcess);
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const handleGameWindowReady = jest.fn();
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
            handleGameWindowReady,
        });

        const normalExit = (service as any).launchBeatSaber({
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:/Beat Saber",
        }).exit;
        normalProcess.emit("exit", 0);
        await normalExit;

        const adminExit = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await Promise.resolve();
        adminProcess.emit("exit", 0);
        await adminExit;

        expect(handleGameWindowReady).toHaveBeenNthCalledWith(1, normalProcess, "C:/Beat Saber", expect.any(Date));
        expect(handleGameWindowReady).toHaveBeenNthCalledWith(2, adminProcess, "C:/Beat Saber", expect.any(Date));
    });

    it("hands off SteamVR restoration when quit starts before the elevated helper exits", async () => {
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 84,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (pathExists as jest.Mock).mockResolvedValue(true);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const restoreSteamVR = jest.fn().mockResolvedValue(undefined);
        const handoffSteamVRRestore = jest.fn().mockResolvedValue(undefined);
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR,
            handoffSteamVRRestore,
            handleGameWindowReady: jest.fn(),
        });

        let settled = false;
        (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {}).finally(() => {
            settled = true;
        });
        await Promise.resolve();
        const willQuitHandler = (app.on as jest.Mock).mock.calls.find(([event]) => event === "will-quit")[1];
        const quitEvent = { preventDefault: jest.fn() };

        await willQuitHandler(quitEvent);

        await Promise.resolve();
        expect(settled).toBe(false);
        expect(handoffSteamVRRestore).toHaveBeenCalledWith(expect.stringMatching(/Beat Saber[\\/]Beat Saber\.exe$/), expect.any(Date));
        expect(restoreSteamVR).not.toHaveBeenCalled();
        expect(quitEvent.preventDefault).toHaveBeenCalled();
        expect(adminProcess.unref).toHaveBeenCalled();
        expect(app.quit).toHaveBeenCalled();
    });

    it("does not resume the in-process restore finalizer after an early elevated handoff", async () => {
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 84,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (pathExists as jest.Mock).mockResolvedValue(true);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const restoreSteamVR = jest.fn().mockResolvedValue(undefined);
        const handoffSteamVRRestore = jest.fn().mockResolvedValue(undefined);
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            steam: { getSteamPath: jest.fn().mockResolvedValue("C:/Steam") },
            localVersions: { getInstalledVersionPath: jest.fn().mockResolvedValue("C:/Beat Saber") },
            linux: { getProtonPrefix: jest.fn().mockResolvedValue("proton") },
            backupSteamVR: jest.fn().mockResolvedValue(false),
            restoreSteamVR,
            handoffSteamVRRestore,
            handleGameWindowReady: jest.fn(),
        });
        const launchOptions: LaunchOption = {
            version: { BSVersion: "1.40.0", steam: true },
            admin: true,
            launchMods: ["fpfc", "skip_steam"] as LaunchOption["launchMods"],
        };

        const subscription = service.launch(launchOptions).subscribe();
        let willQuitHandler: ((event: { preventDefault: jest.Mock }) => Promise<void>) | undefined;
        for (let attempt = 0; attempt < 20 && !willQuitHandler; attempt++) {
            await Promise.resolve();
            willQuitHandler = (app.on as jest.Mock).mock.calls.find(([event]) => event === "will-quit")?.[1];
        }
        expect(willQuitHandler).toBeDefined();

        await willQuitHandler!({ preventDefault: jest.fn() });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(handoffSteamVRRestore).toHaveBeenCalledWith(expect.stringMatching(/Beat Saber[\\/]Beat Saber\.exe$/), expect.any(Date));
        expect(restoreSteamVR).not.toHaveBeenCalled();
        subscription.unsubscribe();
    });

    it("keeps the watcher handoff terminal when the elevated helper exits during startup", async () => {
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 84,
            unref: jest.fn(),
        });
        let completeHandoff: () => void;
        const handoffSteamVRRestore = jest.fn(() => new Promise<void>(resolve => {
            completeHandoff = resolve;
        }));
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
            handoffSteamVRRestore,
            handleGameWindowReady: jest.fn(),
        });
        let settled = false;
        (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {}).finally(() => {
            settled = true;
        });
        await Promise.resolve();
        const willQuitHandler = (app.on as jest.Mock).mock.calls.find(([event]) => event === "will-quit")[1];

        const handlingQuit = willQuitHandler({ preventDefault: jest.fn() });
        adminProcess.emit("exit", 0);
        completeHandoff!();
        await handlingQuit;
        await Promise.resolve();
        await Promise.resolve();

        expect(settled).toBe(false);
        expect(adminProcess.unref).toHaveBeenCalled();
        expect(app.quit).toHaveBeenCalled();
    });

    it("hands off elevated SteamVR restoration instead of restoring during quit", async () => {
        jest.useFakeTimers();
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 84,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (getProcessIds as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([84])
            .mockResolvedValue([84]);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const restoreSteamVR = jest.fn().mockResolvedValue(undefined);
        const handoffSteamVRRestore = jest.fn().mockResolvedValue(undefined);
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR,
            handoffSteamVRRestore,
            handleGameWindowReady: jest.fn(),
        });

        (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await Promise.resolve();
        adminProcess.emit("exit", 0);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        const willQuitHandlers = (app.on as jest.Mock).mock.calls
            .filter(([event]) => event === "will-quit")
            .map(([, handler]) => handler);
        const quitEvent = { preventDefault: jest.fn() };

        await willQuitHandlers.at(-1)(quitEvent);

        expect(handoffSteamVRRestore).toHaveBeenCalledWith("C:/Beat Saber/Beat Saber.exe", expect.any(Date));
        expect(restoreSteamVR).not.toHaveBeenCalled();
        expect(quitEvent.preventDefault).toHaveBeenCalled();
        expect(app.quit).toHaveBeenCalled();
    });

    it("waits for the elevated helper to report Beat Saber exit", async () => {
        jest.useFakeTimers();
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 84,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (getProcessIds as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([84])
            .mockResolvedValue([84]);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
            handleGameWindowReady: jest.fn(),
        });

        let settled = false;
        const exit = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {})
            .then((code: number) => {
                settled = true;
                return code;
            });

        jest.advanceTimersByTime(35_000);
        await Promise.resolve();
        expect(settled).toBe(false);

        adminProcess.emit("exit", 0);
        await Promise.resolve();
        await Promise.resolve();
        expect(settled).toBe(false);

        (getProcessIds as jest.Mock).mockResolvedValue([]);
        await jest.advanceTimersByTimeAsync(1_000);
        await expect(exit).resolves.toBe(0);
        jest.useRealTimers();
    });

    it("tracks the newly launched elevated PID instead of an existing Beat Saber", async () => {
        jest.useFakeTimers();
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 84,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (getProcessIds as jest.Mock)
            .mockResolvedValueOnce([11])
            .mockResolvedValueOnce([11, 84])
            .mockResolvedValueOnce([11, 84])
            .mockResolvedValue([11]);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
            handleGameWindowReady: jest.fn(),
        });

        const exit = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await Promise.resolve();
        adminProcess.emit("exit", 0);
        await Promise.resolve();
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(1_000);

        await expect(exit).resolves.toBe(0);
        expect(getProcessIds).toHaveBeenCalled();
    });

    it("finishes the existing-PID snapshot before starting the elevated helper", async () => {
        let resolveExistingProcessIds: (processIds: number[]) => void;
        const existingProcessIds = new Promise<number[]>(resolve => {
            resolveExistingProcessIds = resolve;
        });
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 84,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (getProcessIds as jest.Mock)
            .mockReturnValueOnce(existingProcessIds)
            .mockResolvedValue([]);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
            handleGameWindowReady: jest.fn(),
        });

        const exit = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        expect(exec).not.toHaveBeenCalled();

        resolveExistingProcessIds!([11]);
        await Promise.resolve();
        expect(exec).toHaveBeenCalledTimes(1);

        adminProcess.emit("exit", 0);
        await expect(exit).resolves.toBe(0);
    });
});
