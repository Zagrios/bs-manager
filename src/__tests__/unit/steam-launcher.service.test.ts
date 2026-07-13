import { pathExists, remove } from "fs-extra";
import { lastValueFrom } from "rxjs";
import { SteamLauncherService } from "main/services/bs-launcher/steam-launcher.service";
import { LaunchOption } from "shared/models/bs-launch";
import { exec, spawn } from "child_process";
import { EventEmitter } from "events";
import { bsmSpawn, getProcessIds, getProcessesByName } from "main/helpers/os.helpers";
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
    remove: jest.fn(),
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

beforeAll(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
});

afterAll(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: originalPlatform });
});

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
        (service as any).launchBeatSaberNormally = jest.fn().mockResolvedValue(0);

        return { service, steam };
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (getProcessIds as jest.Mock).mockReset().mockResolvedValue([]);
        (getProcessesByName as jest.Mock).mockReset();
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

    it("uses an explicit Linux environment builder when Linux is simulated", async () => {
        Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
        try {
            const { service } = buildService();
            const launchOptions: LaunchOption = {
                version: {
                    BSVersion: "1.29.1",
                    steam: true,
                },
                launchMods: ["skip_steam"] as LaunchOption["launchMods"],
            };

            await lastValueFrom(service.launch(launchOptions));

            expect((service as any).linux.buildEnvVariables).toHaveBeenCalledWith(
                launchOptions,
                "C:/Steam",
                "C:/Beat Saber"
            );
        } finally {
            Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
        }
    });
});

describe("SteamLauncherService administrator lifecycle", () => {
    const originalSystemRoot = process.env.SystemRoot;
    const processStartedAt = new Date("2099-01-01T00:00:00.000Z");

    function launchNormal(
        service: SteamLauncherService,
        options: { cmdlet: string; env: {}; customEnv: {}; beatSaberFolderPath: string },
        existingProcessIds: number[] = []
    ) {
        return (service as any).launchBeatSaber(options, {
            existingProcessIds: new Set(existingProcessIds),
            launchedAfter: new Date("2026-07-13T08:00:00.000Z"),
        });
    }

    async function waitForAdminHelperStart(): Promise<void> {
        for (let attempt = 0; attempt < 20 && !(exec as unknown as jest.Mock).mock.calls.length; attempt++) {
            await Promise.resolve();
        }
        expect(exec).toHaveBeenCalledTimes(1);
    }

    async function waitForWillQuitHandler(): Promise<(event: { preventDefault: jest.Mock }) => Promise<void>> {
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
        (getProcessIds as jest.Mock).mockReset().mockResolvedValue([]);
        (getProcessesByName as jest.Mock).mockReset().mockImplementation(async (name: string) => (
            await (getProcessIds as jest.Mock)(name)
        ).map((pid: number) => ({
            pid,
            ppid: 0,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
            startTime: processStartedAt,
        })));
        (remove as jest.Mock).mockResolvedValue(undefined);
    });

    beforeAll(() => {
        process.env.SystemRoot = "C:\\Windows";
    });

    afterAll(() => {
        if (originalSystemRoot === undefined) {
            delete process.env.SystemRoot;
        } else {
            process.env.SystemRoot = originalSystemRoot;
        }
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
        (getProcessIds as jest.Mock).mockResolvedValue([85]);
        (spawn as jest.Mock).mockReturnValue(restoreWatcher);
        (pathExists as jest.Mock).mockResolvedValue(true);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const restoreSteamVR = jest.fn().mockResolvedValue(undefined);
        Object.assign(service as any, {
            steam: { getGameFolder: jest.fn().mockResolvedValue("C:/SteamVR") },
            restoreSteamVR,
            handleGameWindowReady: jest.fn(),
        });

        launchNormal(service, {
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
        expect(script).toContain("$TargetProcessId = 85");
        expect(script).toContain(`$TargetProcessStartedAtUtc = [DateTime]::Parse('${processStartedAt.toISOString()}').ToUniversalTime()`);
        expect(script).toContain("Get-Process -Id $TargetProcessId");
        expect(script).toContain("$processStartedAtUtc.ToString(\"yyyy-MM-ddTHH:mm:ss.fffZ\") -eq");
        expect(script).toContain("$ownedProcessId");
        expect(script).toContain("if ($null -eq $ownedProcess) {\n    exit 2");
        expect(script).toContain("[System.IO.File]::WriteAllText($HandoffReadyPath, \"$ownedProcessId\")");
        expect(spawn).toHaveBeenCalledWith("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", expect.any(Array), expect.objectContaining({
            detached: true,
            shell: false,
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
        (getProcessIds as jest.Mock).mockResolvedValue([85]);
        (spawn as jest.Mock).mockReturnValue(restoreWatcher);
        (pathExists as jest.Mock).mockImplementation(async filePath => !String(filePath).endsWith(".ready"));
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const restoreSteamVR = jest.fn().mockResolvedValue(undefined);
        Object.assign(service as any, {
            steam: { getGameFolder: jest.fn().mockResolvedValue("C:/SteamVR") },
            restoreSteamVR,
            handleGameWindowReady: jest.fn(),
        });

        const { exit } = launchNormal(service, {
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:/Beat Saber",
        });
        const willQuitHandler = (app.on as jest.Mock).mock.calls.find(([event]) => event === "will-quit")[1];
        const quitEvent = { preventDefault: jest.fn() };

        const handlingQuit = willQuitHandler(quitEvent);
        for (let attempt = 0; attempt < 20 && !(spawn as jest.Mock).mock.calls.length; attempt++) {
            await Promise.resolve();
        }
        restoreWatcher.emit("error", new Error("spawn failed"));
        await handlingQuit;

        expect(quitEvent.preventDefault).toHaveBeenCalled();
        expect(gameProcess.unref).not.toHaveBeenCalled();
        expect(app.quit).not.toHaveBeenCalled();
        expect(restoreSteamVR).not.toHaveBeenCalled();

        gameProcess.emit("exit", 0);
        await expect(exit).resolves.toBe(0);
    });

    it("keeps launch ownership when the SteamVR watcher exits before claiming Beat Saber", async () => {
        const gameProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 42,
            unref: jest.fn(),
        });
        const restoreWatcher = Object.assign(new EventEmitter(), {
            unref: jest.fn(),
        });
        (bsmSpawn as jest.Mock).mockReturnValue(gameProcess);
        (getProcessIds as jest.Mock).mockResolvedValue([85]);
        (spawn as jest.Mock).mockReturnValue(restoreWatcher);
        (pathExists as jest.Mock).mockImplementation(async filePath => !String(filePath).endsWith(".ready"));
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        Object.assign(service as any, {
            steam: { getGameFolder: jest.fn().mockResolvedValue("C:/SteamVR") },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
            handleGameWindowReady: jest.fn(),
        });

        const { exit } = launchNormal(service, {
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:/Beat Saber",
        });
        const willQuitHandler = (app.on as jest.Mock).mock.calls.find(([event]) => event === "will-quit")[1];
        const quitEvent = { preventDefault: jest.fn() };

        const handlingQuit = willQuitHandler(quitEvent);
        for (let attempt = 0; attempt < 20 && !(spawn as jest.Mock).mock.calls.length; attempt++) {
            await Promise.resolve();
        }
        restoreWatcher.emit("spawn");
        restoreWatcher.emit("exit", 2);
        await handlingQuit;

        expect(quitEvent.preventDefault).toHaveBeenCalled();
        expect(gameProcess.unref).not.toHaveBeenCalled();
        expect(restoreWatcher.unref).not.toHaveBeenCalled();
        expect(app.quit).not.toHaveBeenCalled();

        gameProcess.emit("exit", 0);
        await expect(exit).resolves.toBe(0);
    });

    it("binds a normal launch to the newly observed Beat Saber process instead of its shell wrapper", async () => {
        const wrapperProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 42,
            unref: jest.fn(),
        });
        const observedAt = Date.now();
        let resolveSnapshot: (processes: unknown[]) => void;
        const snapshot = new Promise<unknown[]>(resolve => {
            resolveSnapshot = resolve;
        });
        (bsmSpawn as jest.Mock).mockReturnValue(wrapperProcess);
        (pathExists as jest.Mock).mockResolvedValue(true);
        (getProcessesByName as jest.Mock)
            .mockReturnValueOnce(snapshot)
            .mockResolvedValueOnce([
                { pid: 11, name: "Beat Saber.exe", cmd: "C:/Beat Saber/Beat Saber.exe", startTime: new Date(observedAt - 60_000) },
                { pid: 84, name: "Beat Saber.exe", cmd: "C:/Other Copy/Beat Saber.exe", startTime: new Date(observedAt + 1_000) },
                { pid: 85, name: "Beat Saber.exe", cmd: "C:/Beat Saber/Beat Saber.exe", startTime: new Date(observedAt + 2_000) },
            ]);
        const handleGameWindowReady = jest.fn();
        const handoffSteamVRRestore = jest.fn().mockResolvedValue(undefined);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        Object.assign(service as any, {
            steam: {
                getSteamPath: jest.fn().mockResolvedValue("C:/Steam"),
                isSteamRunning: jest.fn().mockResolvedValue(true),
            },
            localVersions: { getInstalledVersionPath: jest.fn().mockResolvedValue("C:/Beat Saber") },
            linux: {
                buildEnvVariables: jest.fn().mockResolvedValue({}),
                getProtonPrefix: jest.fn().mockResolvedValue("proton"),
            },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
            handleGameWindowReady,
            handoffSteamVRRestore,
        });

        const completion = lastValueFrom(service.launch({
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: ["skip_steam"] as LaunchOption["launchMods"],
        }));
        for (let attempt = 0; attempt < 20 && !(getProcessesByName as jest.Mock).mock.calls.length; attempt++) {
            await Promise.resolve();
        }
        expect(bsmSpawn).not.toHaveBeenCalled();
        resolveSnapshot!([
            { pid: 11, name: "Beat Saber.exe", cmd: "C:/Beat Saber/Beat Saber.exe", startTime: new Date(observedAt - 60_000) },
        ]);
        for (let attempt = 0; attempt < 50 && !handleGameWindowReady.mock.calls.length; attempt++) {
            await Promise.resolve();
        }
        const willQuitHandler = await waitForWillQuitHandler();
        await willQuitHandler({ preventDefault: jest.fn() });
        wrapperProcess.emit("exit", 0);
        await completion;

        expect(wrapperProcess.pid).not.toBe(85);
        expect(getProcessesByName).toHaveBeenCalledTimes(2);
        expect(handleGameWindowReady).toHaveBeenCalledWith(
            wrapperProcess,
            "C:/Beat Saber",
            expect.any(Date),
            85,
            expect.any(AbortSignal),
            new Date(observedAt + 2_000)
        );
        expect(handoffSteamVRRestore).toHaveBeenCalledWith(
            expect.stringMatching(/Beat Saber[\\/]Beat Saber\.exe$/),
            expect.any(Date),
            85,
            new Date(observedAt + 2_000)
        );
    });

    it.each(["error", "exit"] as const)("cancels normal target acquisition when the shell wrapper emits %s", async eventName => {
        const wrapperProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 42,
            unref: jest.fn(),
        });
        (bsmSpawn as jest.Mock).mockReturnValue(wrapperProcess);
        (getProcessesByName as jest.Mock).mockReturnValue(new Promise(() => {
            // Intentionally pending so the wrapper event must cancel acquisition.
        }));
        const handleGameWindowReady = jest.fn();
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        Object.assign(service as any, { handleGameWindowReady });

        const { exit } = launchNormal(service, {
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:/Beat Saber",
        });
        const wrapperError = new Error("wrapper failed");
        const exitResult = exit.catch((error: Error) => error);

        if (eventName === "error") {
            wrapperProcess.emit("error", wrapperError);
        } else {
            wrapperProcess.emit("exit", 0);
        }
        expect(await exitResult).toEqual(eventName === "error" ? wrapperError : 0);
        await Promise.resolve();

        expect(handleGameWindowReady).not.toHaveBeenCalled();
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
        (getProcessIds as jest.Mock).mockResolvedValue([85]);
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const handleGameWindowReady = jest.fn();
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
            handleGameWindowReady,
        });

        const normalExit = launchNormal(service, {
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:/Beat Saber",
        }).exit;
        for (let attempt = 0; attempt < 20 && !handleGameWindowReady.mock.calls.length; attempt++) {
            await Promise.resolve();
        }
        normalProcess.emit("exit", 0);
        await normalExit;

        (getProcessIds as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([85])
            .mockResolvedValueOnce([]);
        const adminExit = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await waitForAdminHelperStart();
        adminProcess.emit("exit", 0);
        await adminExit;

        expect(handleGameWindowReady).toHaveBeenNthCalledWith(
            1,
            normalProcess,
            "C:/Beat Saber",
            expect.any(Date),
            85,
            expect.any(AbortSignal),
            processStartedAt
        );
        expect(handleGameWindowReady).toHaveBeenNthCalledWith(
            2,
            adminProcess,
            "C:/Beat Saber",
            expect.any(Date),
            85,
            expect.any(AbortSignal),
            processStartedAt
        );
    });

    it("binds elevated window polling to the selected Beat Saber PID until it exits", async () => {
        jest.useFakeTimers();
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 70,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (getProcessIds as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([85])
            .mockResolvedValueOnce([85])
            .mockResolvedValueOnce([]);
        const handleGameWindowReady = jest.fn();
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
            handleGameWindowReady,
        });

        const exit = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await waitForAdminHelperStart();
        const pollingStartedBeforeOwnership = handleGameWindowReady.mock.calls.length > 0;
        adminProcess.emit("exit", 0);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(1_000);
        await expect(exit).resolves.toBe(0);
        const focusSignal = handleGameWindowReady.mock.calls.at(-1)?.[4] as AbortSignal | undefined;

        expect(pollingStartedBeforeOwnership).toBe(false);
        expect(handleGameWindowReady).toHaveBeenCalledWith(
            adminProcess,
            "C:/Beat Saber",
            expect.any(Date),
            85,
            expect.any(AbortSignal),
            processStartedAt
        );
        expect(focusSignal?.aborted).toBe(true);
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
        const willQuitHandler = await waitForWillQuitHandler();
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
            linux: {
                buildEnvVariables: jest.fn().mockResolvedValue({}),
                getProtonPrefix: jest.fn().mockResolvedValue("proton"),
            },
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
        const willQuitHandler = await waitForWillQuitHandler();

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
        await waitForAdminHelperStart();
        adminProcess.emit("exit", 0);
        for (let attempt = 0; attempt < 20 && (app.on as jest.Mock).mock.calls.filter(([event]) => event === "will-quit").length < 2; attempt++) {
            await Promise.resolve();
        }
        const willQuitHandlers = (app.on as jest.Mock).mock.calls
            .filter(([event]) => event === "will-quit")
            .map(([, handler]) => handler);
        expect(willQuitHandlers).toHaveLength(2);
        const quitEvent = { preventDefault: jest.fn() };

        await willQuitHandlers.at(-1)(quitEvent);

        expect(handoffSteamVRRestore).toHaveBeenCalledWith(
            "C:/Beat Saber/Beat Saber.exe",
            expect.any(Date),
            84,
            processStartedAt
        );
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

        await waitForAdminHelperStart();
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
        await waitForAdminHelperStart();
        adminProcess.emit("exit", 0);
        await Promise.resolve();
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(1_000);

        await expect(exit).resolves.toBe(0);
        expect(getProcessIds).toHaveBeenCalled();
    });

    it("retries a transient process-list failure while acquiring the elevated PID", async () => {
        jest.useFakeTimers();
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 84,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (getProcessIds as jest.Mock)
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error("ps-list unavailable"))
            .mockResolvedValueOnce([84])
            .mockResolvedValueOnce([84])
            .mockResolvedValueOnce([]);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
            handleGameWindowReady: jest.fn(),
        });

        const exit = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        const exitExpectation = (async () => {
            await expect(exit).resolves.toBe(0);
        })();
        for (let attempt = 0; attempt < 5 && !(exec as unknown as jest.Mock).mock.calls.length; attempt++) {
            await Promise.resolve();
        }
        expect(exec).toHaveBeenCalledTimes(1);
        adminProcess.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(1_100);

        await exitExpectation;
        expect(getProcessIds).toHaveBeenCalledTimes(5);
    });

    it("tracks only the new elevated process at the requested executable path", async () => {
        jest.useFakeTimers({ now: new Date("2026-07-13T08:00:00.000Z") });
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 70,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (getProcessIds as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([84, 85])
            .mockResolvedValueOnce([84, 85])
            .mockResolvedValueOnce([84])
            .mockResolvedValueOnce([]);
        (getProcessesByName as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { pid: 84, name: "Beat Saber.exe", cmd: "C:/Other Copy/Beat Saber.exe", startTime: new Date("2026-07-13T08:00:00.001Z") },
                { pid: 85, name: "Beat Saber.exe", cmd: "C:/Beat Saber/Beat Saber.exe", startTime: new Date("2026-07-13T08:00:00.002Z") },
            ])
            .mockResolvedValueOnce([
                { pid: 84, name: "Beat Saber.exe", cmd: "C:/Other Copy/Beat Saber.exe", startTime: new Date("2026-07-13T08:00:00.001Z") },
                { pid: 85, name: "Beat Saber.exe", cmd: "C:/Beat Saber/Beat Saber.exe", startTime: new Date("2026-07-13T08:00:00.002Z") },
            ])
            .mockResolvedValueOnce([
                { pid: 84, name: "Beat Saber.exe", cmd: "C:/Other Copy/Beat Saber.exe", startTime: new Date("2026-07-13T08:00:00.001Z") },
            ])
            .mockResolvedValueOnce([]);
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
        for (let attempt = 0; attempt < 5 && !(exec as unknown as jest.Mock).mock.calls.length; attempt++) {
            await Promise.resolve();
        }
        adminProcess.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(1_000);
        const settledWhenRequestedProcessExited = settled;

        if (!settled) {
            await jest.advanceTimersByTimeAsync(1_000);
        }
        await expect(exit).resolves.toBe(0);
        expect(settledWhenRequestedProcessExited).toBe(true);
    });

    it("accepts a quoted command line only when it starts with the exact executable path", () => {
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const launchedAfter = new Date("2026-07-13T08:00:00.000Z");

        expect((service as any).processTargetsExecutable({
            pid: 85,
            name: "Beat Saber.exe",
            cmd: "\"C:/Beat Saber/Beat Saber.exe\" fpfc",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
        }, "C:/Beat Saber/Beat Saber.exe", launchedAfter)).toBe(true);
        expect((service as any).processTargetsExecutable({
            pid: 86,
            name: "Beat Saber.exe",
            cmd: "\"C:/Other Copy/Beat Saber.exe\" fpfc",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
        }, "C:/Beat Saber/Beat Saber.exe", launchedAfter)).toBe(false);
    });

    it("does not claim a process without both exact command-path and start-time evidence", () => {
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const launchedAfter = new Date("2026-07-13T08:00:00.000Z");

        expect((service as any).processTargetsExecutable({
            pid: 85,
            name: "Beat Saber.exe",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
        }, "C:/Beat Saber/Beat Saber.exe", launchedAfter)).toBe(false);
        expect((service as any).processTargetsExecutable({
            pid: 85,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
        }, "C:/Beat Saber/Beat Saber.exe", launchedAfter)).toBe(false);
        expect((service as any).processTargetsExecutable({
            pid: 85,
            name: "Beat Saber.exe",
            cmd: "C:/Beat Saber/Beat Saber.exe",
            startTime: new Date("2026-07-13T08:00:00.001Z"),
        }, "C:/Beat Saber/Beat Saber.exe", launchedAfter)).toBe(true);
    });

    it("does not guess between exact new candidates without unique wrapper-parent evidence", () => {
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const launchedAfter = new Date("2026-07-13T08:00:00.000Z");
        const candidates = [
            {
                pid: 85,
                ppid: 42,
                name: "Beat Saber.exe",
                cmd: "C:/Beat Saber/Beat Saber.exe",
                startTime: new Date("2026-07-13T08:00:00.001Z"),
            },
            {
                pid: 86,
                ppid: 77,
                name: "Beat Saber.exe",
                cmd: "C:/Beat Saber/Beat Saber.exe",
                startTime: new Date("2026-07-13T08:00:00.002Z"),
            },
        ];

        expect((service as any).selectOwnedProcess(
            candidates,
            new Set(),
            "C:/Beat Saber/Beat Saber.exe",
            launchedAfter
        )).toBeUndefined();
        expect((service as any).selectOwnedProcess(
            candidates,
            new Set(),
            "C:/Beat Saber/Beat Saber.exe",
            launchedAfter,
            42
        )?.pid).toBe(85);
    });

    it("polls for a bounded time when the elevated process is initially absent", async () => {
        jest.useFakeTimers();
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 70,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (getProcessIds as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([84])
            .mockResolvedValueOnce([84])
            .mockResolvedValueOnce([]);
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
        for (let attempt = 0; attempt < 5 && !(exec as unknown as jest.Mock).mock.calls.length; attempt++) {
            await Promise.resolve();
        }
        adminProcess.emit("exit", 0);
        await Promise.resolve();
        await Promise.resolve();
        const settledAfterFirstAbsence = settled;
        await jest.advanceTimersByTimeAsync(1_250);

        await expect(exit).resolves.toBe(0);
        expect(settledAfterFirstAbsence).toBe(false);
        expect(getProcessIds).toHaveBeenCalledTimes(5);
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
        await waitForAdminHelperStart();

        adminProcess.emit("exit", 1);
        await expect(exit).resolves.toBe(1);
    });
});
