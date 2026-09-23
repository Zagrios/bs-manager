import { pathExists, rename } from "fs-extra";
import { lastValueFrom } from "rxjs";
import { SteamLauncherService } from "main/services/bs-launcher/steam-launcher.service";
import { BSLaunchEventData, LaunchOption } from "shared/models/bs-launch";
import { execFile, spawn } from "node:child_process";
import { EventEmitter } from "events";
import { bsmSpawn, getProcessesByName } from "main/helpers/os.helpers";
import { app } from "electron";
import path from "path";
import { parseLaunchOptions } from "main/helpers/launchOptions.helper";

jest.mock("node:child_process", () => ({
    ...jest.requireActual("node:child_process"),
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
    rename: jest.fn(),
}));

jest.mock("main/constants", () => ({
    BS_APP_ID: "620980",
    BS_EXECUTABLE: "Beat Saber.exe",
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
        util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
    });
    return service;
}

async function flushPromises(): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt++) {
        await Promise.resolve();
    }
}

async function currentWillQuitHandler(): Promise<(event: { preventDefault: jest.Mock }) => void> {
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
    (getProcessesByName as jest.Mock).mockResolvedValue([]);
});

afterEach(() => {
    jest.useRealTimers();
});

describe("SteamLauncherService launch options", () => {
    function buildService() {
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
            launchBeatSaberNormally: jest.fn().mockResolvedValue(0),
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

    it.each<{ mods: LaunchOption["launchMods"] }>([
        { mods: [] }, { mods: ["fpfc"] }, { mods: ["oculus"] }, { mods: ["fpfc", "oculus"] },
    ])("never looks up or restores a legacy SteamVR backup ($mods)", async ({ mods }) => {
        (pathExists as jest.Mock).mockResolvedValue(true);
        const { service, steam } = buildService();
        const getGameFolder = jest.fn().mockResolvedValue("C:/SteamVR");
        Object.assign(steam, { getGameFolder });

        await lastValueFrom(service.launch({ version: { BSVersion: "1.45.1", steam: true }, launchMods: mods }));

        expect(getGameFolder).not.toHaveBeenCalled();
        expect(pathExists).toHaveBeenCalledTimes(1);
        expect(pathExists).toHaveBeenCalledWith(path.join("C:/Beat Saber", "Beat Saber.exe"));
        expect(rename).not.toHaveBeenCalled();
        expect(spawn).not.toHaveBeenCalled();
    });

    it.each(["1.29.1", "1.40.0"])("blocks VR loaders for FPFC %s without renaming SteamVR or requesting admin", async version => {
        (pathExists as jest.Mock).mockResolvedValue(true);
        const { service } = buildService();
        const parentOpenVr = process.env.VR_OVERRIDE;
        const parentOpenXr = process.env.XR_RUNTIME_JSON;
        const events: BSLaunchEventData[] = [];

        await new Promise<void>((resolve, reject) => {
            service.launch({
                version: { BSVersion: version, steam: true },
                launchMods: ["fpfc"],
            }).subscribe({ next: event => events.push(event), complete: resolve, error: reject });
        });

        expect(rename).not.toHaveBeenCalled();
        expect(events).not.toContainEqual({ type: "FPFC_NEED_ADMIN" });
        const { env, args } = (service as any).launchBeatSaberNormally.mock.calls[0][0];
        expect(env.VR_OVERRIDE).toBe(path.join("C:/Beat Saber", "Beat Saber.exe"));
        expect(env.XR_RUNTIME_JSON).toBe(path.join("C:/Beat Saber", "Beat Saber.exe", "disabled-openxr.json"));
        expect(args).toEqual(expect.arrayContaining(["fpfc", "-vrmode", "None"]));
        expect(process.env.VR_OVERRIDE).toBe(parentOpenVr);
        expect(process.env.XR_RUNTIME_JSON).toBe(parentOpenXr);
    });

    it("keeps FPFC runtime suppression when custom launch options select a VR runtime", async () => {
        (pathExists as jest.Mock).mockResolvedValue(true);
        const { service } = buildService();
        jest.mocked(parseLaunchOptions).mockReturnValueOnce({
            env: { VR_OVERRIDE: "C:/SteamVR", XR_RUNTIME_JSON: "C:/SteamVR/steamxr_win64.json" },
            cmdlet: "Beat Saber.exe",
            args: "",
        });

        await lastValueFrom(service.launch({ version: { BSVersion: "1.40.0", steam: true }, launchMods: ["fpfc"] }));

        const { env, customEnv } = (service as any).launchBeatSaberNormally.mock.calls[0][0];
        const launchEnv = { ...customEnv, ...env };
        expect(launchEnv.VR_OVERRIDE).toBe(path.join("C:/Beat Saber", "Beat Saber.exe"));
        expect(launchEnv.XR_RUNTIME_JSON).toBe(path.join("C:/Beat Saber", "Beat Saber.exe", "disabled-openxr.json"));
    });

    it.each<{ mods: LaunchOption["launchMods"] }>([{ mods: [] }, { mods: ["oculus"] }, { mods: ["oculus", "fpfc"] }])(
        "preserves VR runtime overrides outside headset-free FPFC ($mods)", async ({ mods }) => {
            (pathExists as jest.Mock).mockResolvedValue(true);
            const { service } = buildService();
            const runtimeEnv = { VR_OVERRIDE: "C:/OpenComposite", XR_RUNTIME_JSON: "C:/Oculus/oculus.json" };
            jest.mocked(parseLaunchOptions).mockReturnValueOnce({ env: { ...runtimeEnv }, cmdlet: "Beat Saber.exe", args: "" });

            await lastValueFrom(service.launch({ version: { BSVersion: "1.29.1", steam: true }, launchMods: mods }));

            const { env, customEnv, args } = (service as any).launchBeatSaberNormally.mock.calls[0][0];
            const launchEnv = { ...customEnv, ...env };
            expect(launchEnv.VR_OVERRIDE).toBe(runtimeEnv.VR_OVERRIDE);
            expect(launchEnv.XR_RUNTIME_JSON).toBe(runtimeEnv.XR_RUNTIME_JSON);
            expect(args).not.toContain("None");
        }
    );

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

    it("reports normal spawn failure", async () => {
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
    });

    it("reports UAC cancellation before the elevated helper starts", async () => {
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
    });

    it("reports UAC cancellation after elevation stdout ends", async () => {
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
    });

    it("reports elevation channel failure after the helper starts", async () => {
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
    });

    it("cleans up ownership after an exit enumeration failure", async () => {
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
        const options: LaunchOption = {
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"],
        };

        const launch = lastValueFrom(service.launch(options));
        const rejection = launch.catch(error => error);
        const handler = await currentWillQuitHandler();

        await expect(rejection).resolves.toThrow("monitor failed");
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
    it.each(["win32", "linux"])("detaches an owned game without delaying %s quit or starting a helper", async platform => {
        Object.defineProperty(process, "platform", { configurable: true, value: platform });
        try {
            const wrapper = processHandle(42);
            (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
            const service = serviceWithConfig(true);
            jest.spyOn(service as any, "findOwnedProcess").mockResolvedValue({ pid: 85, startedAt: processStartedAt });
            let signal: AbortSignal | undefined;
            jest.spyOn(service as any, "waitForOwnedProcessExit").mockImplementation((...args: unknown[]) => {
                signal = args[2] as AbortSignal;
                return new Promise(resolve => {
                    signal!.addEventListener("abort", () => resolve(false), { once: true });
                });
            });

            const launch = (service as any).launchTrackedBeatSaber(launchOptions, { existingProcessIds: new Set(), launchedAfter });
            await flushPromises();
            expect(app.quit).toHaveBeenCalledTimes(1);
            (app.quit as jest.Mock).mockClear();
            const handler = await currentWillQuitHandler();
            const event = { preventDefault: jest.fn() };

            handler(event);

            await expect(launch).resolves.toBe(0);
            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(app.quit).not.toHaveBeenCalled();
            expect(signal?.aborted).toBe(true);
            expect(wrapper.unref).toHaveBeenCalledTimes(1);
            expect(wrapper.kill).not.toHaveBeenCalled();
            expect(spawn).not.toHaveBeenCalled();
            expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);
        } finally {
            Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
        }
    });

    it("waits for Linux ownership acquisition after wrapper exit", async () => {
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
            await expect(launch).resolves.toBe(7);
        } finally {
            Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
        }
    });

    it("continues bounded ownership after a nonzero wrapper exit without premature close", async () => {
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
                },
                localVersions: { getInstalledVersionPath: jest.fn(async () => "C:/Beat Saber") },
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

        expect(app.quit).not.toHaveBeenCalled();

        resolveOwnership!([owned, concurrent]);
        await flushPromises();

        expect(app.quit).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1_000);
        await launch;
    });

    it("waits for delayed ownership after a successful wrapper exit", async () => {
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

        const launch = (service as any).launchTrackedBeatSaber(launchOptions, {
            existingProcessIds: new Set(),
            launchedAfter,
        });
        wrapper.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(5_000);

        expect(app.quit).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1_000);
        expect(app.quit).toHaveBeenCalledTimes(1);

        (getProcessesByName as jest.Mock).mockResolvedValue([]);
        await jest.advanceTimersByTimeAsync(1_000);
        await expect(launch).resolves.toBe(0);
    });

    it("completes after an early wrapper success plus acquisition timeout", async () => {
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

        await expect(launch).resolves.toBe(0);
    });

    it("completes an unowned launch when the optional ownership snapshot fails", async () => {
        jest.useFakeTimers();
        const wrapper = processHandle(42);
        (bsmSpawn as jest.Mock).mockReturnValue(wrapper);
        (getProcessesByName as jest.Mock).mockRejectedValue(new Error("process list unavailable"));
        const service = serviceWithConfig();

        const launch = (service as any).launchBeatSaberNormally(launchOptions);
        await jest.advanceTimersByTimeAsync(500);

        expect(bsmSpawn).toHaveBeenCalledTimes(1);
        wrapper.emit("exit", 0);
        await expect(launch).resolves.toBe(0);
    });

    it("detaches the wrapper without delaying quit before ownership is known", async () => {
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
        await expect(launch).resolves.toBe(0);
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
        await expect(launch).resolves.toBe(0);
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
});

describe("SteamLauncherService elevated lifecycle", () => {
    it("detaches an owned elevated game without delaying quit or starting another helper", async () => {
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        const service = serviceWithConfig(true);
        jest.spyOn(service as any, "findOwnedProcess").mockResolvedValue({ pid: 85, startedAt: processStartedAt });
        let signal: AbortSignal | undefined;
        jest.spyOn(service as any, "waitForOwnedProcessExit").mockImplementation((...args: unknown[]) => {
            signal = args[2] as AbortSignal;
            return new Promise(resolve => {
                signal!.addEventListener("abort", () => resolve(false), { once: true });
            });
        });
        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await flushPromises();
        reportElevatedHelperPid(helper);
        helper.emit("exit", 0);
        await flushPromises();
        expect(app.quit).toHaveBeenCalledTimes(1);
        (app.quit as jest.Mock).mockClear();
        const handler = await currentWillQuitHandler();
        const event = { preventDefault: jest.fn() };

        handler(event);

        await expect(launch).resolves.toBe(0);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(app.quit).not.toHaveBeenCalled();
        expect(signal?.aborted).toBe(true);
        expect(helper.unref).toHaveBeenCalledTimes(1);
        expect(helper.stdout.destroy).toHaveBeenCalledTimes(1);
        expect(helper.kill).not.toHaveBeenCalled();
        expect(spawn).toHaveBeenCalledTimes(1);
        expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);
    });

    it("propagates elevated process monitoring failures and cleans up ownership", async () => {
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        const service = serviceWithConfig();
        jest.spyOn(service as any, "findOwnedProcess").mockResolvedValue({ pid: 85, startedAt: processStartedAt });
        jest.spyOn(service as any, "waitForOwnedProcessExit").mockRejectedValue(new Error("monitor failed"));
        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        const failure = launch.catch((error: Error) => error);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        reportElevatedHelperPid(helper);
        helper.emit("exit", 0);

        await expect(failure).resolves.toThrow("monitor failed");
        expect(app.removeListener).toHaveBeenCalledWith("will-quit", handler);
        expect(spawn).toHaveBeenCalledTimes(1);
    });

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

        await expect(launch).resolves.toBe(0);
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
        const failure = launch.catch((error: Error) => error);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        await jest.advanceTimersByTimeAsync(60_000);

        await expect(failure).resolves.toMatchObject({
            message: "Elevated helper PID acquisition timed out",
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
        await expect(launch).resolves.toBe(7);
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
        await expect(launch).resolves.toBe(0);
    });

    it("detaches the helper without delaying quit before elevated ownership is known", async () => {
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        (getProcessesByName as jest.Mock)
            .mockResolvedValueOnce([])
            .mockReturnValue(new Promise(() => {
                // Remains pending until ownership cancellation.
            }));
        const service = serviceWithConfig();

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await flushPromises();
        reportElevatedHelperPid(helper);
        await flushPromises();
        const handler = await currentWillQuitHandler();
        const event = { preventDefault: jest.fn() };

        await handler(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(helper.unref).toHaveBeenCalledTimes(1);
        expect(app.quit).not.toHaveBeenCalled();

        helper.emit("exit", 0);
        await expect(launch).resolves.toBe(0);
    });

    it("completes an unowned elevated launch when the ownership snapshot is unavailable", async () => {
        const helper = processHandle(42);
        (spawn as jest.Mock).mockReturnValue(helper);
        const service = serviceWithConfig();
        jest.spyOn(service as any, "createProcessOwnershipSnapshot").mockResolvedValue(undefined);

        const launch = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {});
        await flushPromises();
        reportElevatedHelperPid(helper);
        await flushPromises();
        helper.emit("exit", 0);

        await expect(launch).resolves.toBe(0);
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
        await expect(launch).resolves.toBe(0);
    });
});
