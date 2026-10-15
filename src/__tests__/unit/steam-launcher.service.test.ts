import { EventEmitter } from "events";
import path from "path";
import { ChildProcess } from "node:child_process";
import log from "electron-log";
import { SteamLauncherPorts, SteamLauncherService } from "main/services/bs-launcher/steam-launcher.service";
import { systemTimers } from "main/services/bs-launcher/owned-process-session";
import { LaunchPlan } from "main/services/bs-launcher/launch-plan";
import { ProcessInfo, ProcessQuery } from "main/helpers/process-table";
import { BSLaunchError, BSLaunchEventData, LaunchOption } from "shared/models/bs-launch";

jest.mock("electron", () => ({ app: { getPath: () => "" } }));
jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("main/services/steam.service", () => ({ SteamService: { getInstance: jest.fn() } }));
jest.mock("main/services/utils.service", () => ({ UtilsService: { getInstance: jest.fn() } }));
jest.mock("main/services/linux.service", () => ({ LinuxService: { getInstance: jest.fn() } }));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: jest.fn() } }));
jest.mock("main/services/static-configuration.service", () => ({ StaticConfigurationService: { getInstance: jest.fn() } }));

const originalSystemRoot = process.env.SystemRoot;
const launchedAfter = new Date("2026-07-13T08:00:00.000Z");
const processStartedAt = new Date("2026-07-13T08:00:00.001Z");
const BS_FOLDER = "C:/Beat Saber";
const BS_EXE = path.join(BS_FOLDER, "Beat Saber.exe");

type FakeChild = ChildProcess & {
    unref: jest.Mock;
    kill: jest.Mock;
    stdout: EventEmitter & { destroy: jest.Mock };
};

function processHandle(pid: number): FakeChild {
    return Object.assign(new EventEmitter(), {
        exitCode: null,
        killed: false,
        pid,
        stdout: Object.assign(new EventEmitter(), { destroy: jest.fn() }),
        kill: jest.fn(),
        unref: jest.fn(),
    }) as unknown as FakeChild;
}

const game = (overrides: Partial<ProcessInfo> = {}): ProcessInfo => ({
    pid: 85,
    ppid: 42,
    name: "Beat Saber.exe",
    cmd: BS_EXE,
    startTime: processStartedAt,
    ...overrides,
});

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

function buildLauncher(options: {
    platform?: NodeJS.Platform;
    flatpak?: boolean;
    closeOnLaunch?: boolean;
    steamRunning?: boolean;
    exePresent?: boolean;
} = {}) {
    const processes = { list: jest.fn<Promise<ProcessInfo[]>, [ProcessQuery]>().mockResolvedValue([]) };
    const lifecycle = fakeLifecycle();
    const wrapper = processHandle(42);
    const elevation = processHandle(42);
    const ports: SteamLauncherPorts = {
        session: {
            processes,
            timers: systemTimers,
            lifecycle,
            platform: options.platform ?? "win32",
            flatpak: options.flatpak ?? false,
            newLaunchToken: () => "launch-token",
        },
        env: { PARENT_ENV: "1" },
        localVersions: { getInstalledVersionPath: jest.fn(async () => BS_FOLDER) },
        pathExists: jest.fn(async () => options.exePresent ?? true),
        spawnLaunchPlan: jest.fn(() => wrapper),
        isCloseOnLaunchEnabled: () => options.closeOnLaunch ?? false,
        steam: {
            isSteamRunning: jest.fn(async () => options.steamRunning ?? true),
            openSteam: jest.fn(async (): Promise<void> => undefined),
            getSteamPath: jest.fn(async () => "C:/Steam"),
        },
        linux: {
            getProtonConfig: jest.fn(async (steamPath: string) => ({
                protonPath: "/proton/proton",
                compatDataPath: "/bsm/compatdata",
                steamPath,
                nixOS: false,
            })),
        },
        adminHelperPath: () => "C:\\assets\\scripts\\start_beat_saber_admin.exe",
        logsPath: () => "C:/logs",
        spawnElevation: jest.fn(() => elevation),
    };
    return { service: new SteamLauncherService(ports), ports, processes, lifecycle, wrapper, elevation };
}

function launch(service: SteamLauncherService, launchOptions: LaunchOption) {
    const events: BSLaunchEventData[] = [];
    const state: { settled: boolean; error?: any } = { settled: false };
    const done = new Promise<void>((resolve, reject) => {
        service.launch(launchOptions).subscribe({
            next: event => events.push(event),
            complete: () => { state.settled = true; resolve(); },
            error: error => { state.settled = true; state.error = error; reject(error); },
        });
    });
    done.catch(() => {});
    return { events, done, state };
}

async function flush(): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
        await jest.advanceTimersByTimeAsync(0);
    }
}

function reportElevatedHelperPid(elevation: FakeChild, pid = 84): void {
    elevation.stdout.emit("data", Buffer.from(`BSM_ADMIN_HELPER_PID:${pid}\n`, "utf8"));
}

const steamVersion = (overrides: Partial<LaunchOption> = {}): LaunchOption => ({
    version: { BSVersion: "1.29.1", steam: true },
    launchMods: ["skip_steam"] as LaunchOption["launchMods"],
    ...overrides,
});

const plannedLaunch = (ports: SteamLauncherPorts): { plan: LaunchPlan; cwd: string } => {
    const [plan, cwd] = (ports.spawnLaunchPlan as jest.Mock).mock.calls[0];
    return { plan, cwd };
};

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

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: launchedAfter });
});

afterEach(() => {
    jest.useRealTimers();
});

describe("SteamLauncherService launch events and plan", () => {
    async function completeUntracked(wrapper: FakeChild, done: Promise<void>) {
        await flush();
        wrapper.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(60_000);
        await done;
    }

    it("does not open Steam for a legacy skip_steam launch option", async () => {
        const { service, ports, wrapper } = buildLauncher({ steamRunning: false });

        const { done, events } = launch(service, steamVersion());
        await completeUntracked(wrapper, done);

        expect(ports.steam.isSteamRunning).not.toHaveBeenCalled();
        expect(ports.steam.openSteam).not.toHaveBeenCalled();
        expect(events).toEqual([{ type: "BS_LAUNCHING" }]);
    });

    it("opens Steam when it is not running, then launches", async () => {
        const { service, ports, wrapper } = buildLauncher({ steamRunning: false });

        const { done, events } = launch(service, steamVersion({ launchMods: [] }));
        await completeUntracked(wrapper, done);

        expect(ports.steam.openSteam).toHaveBeenCalledTimes(1);
        expect(events).toEqual([{ type: "STEAM_LAUNCHING" }, { type: "STEAM_LAUNCHED" }, { type: "BS_LAUNCHING" }]);
    });

    it("warns and still launches when Steam cannot be opened", async () => {
        const { service, ports, wrapper } = buildLauncher({ steamRunning: false });
        (ports.steam.openSteam as jest.Mock).mockRejectedValue("Unable to open steam");

        const { done, events } = launch(service, steamVersion({ launchMods: [] }));
        await completeUntracked(wrapper, done);

        expect(events).toEqual([{ type: "STEAM_LAUNCHING" }, { type: "UNABLE_TO_LAUNCH_STEAM" }, { type: "BS_LAUNCHING" }]);
    });

    it("fails with BS_NOT_FOUND before any event when the executable is missing", async () => {
        const { service, ports } = buildLauncher({ exePresent: false });

        const { done, events } = launch(service, steamVersion());

        await expect(done).rejects.toMatchObject({ code: BSLaunchError.BS_NOT_FOUND });
        expect(events).toEqual([]);
        expect(ports.spawnLaunchPlan).not.toHaveBeenCalled();
    });

    it.each<{ mods: LaunchOption["launchMods"] }>([
        { mods: [] }, { mods: ["fpfc"] }, { mods: ["oculus"] }, { mods: ["fpfc", "oculus"] },
    ])("never looks up a legacy SteamVR backup or elevates ($mods)", async ({ mods }) => {
        const { service, ports, wrapper } = buildLauncher();

        const { done } = launch(service, { version: { BSVersion: "1.45.1", steam: true }, launchMods: mods });
        await completeUntracked(wrapper, done);

        expect(ports.pathExists).toHaveBeenCalledTimes(1);
        expect(ports.pathExists).toHaveBeenCalledWith(BS_EXE);
        expect(ports.spawnElevation).not.toHaveBeenCalled();
    });

    it.each(["1.29.1", "1.40.0"])("blocks VR loaders for FPFC %s without requesting admin", async version => {
        const { service, ports, wrapper } = buildLauncher();
        const parentOpenVr = process.env.VR_OVERRIDE;
        const parentOpenXr = process.env.XR_RUNTIME_JSON;

        const { done, events } = launch(service, { version: { BSVersion: version, steam: true }, launchMods: ["fpfc"] });
        await completeUntracked(wrapper, done);

        expect(events).not.toContainEqual({ type: "FPFC_NEED_ADMIN" });
        const { plan: { env, args }, cwd } = plannedLaunch(ports);
        expect(cwd).toBe(BS_FOLDER);
        expect(env.VR_OVERRIDE).toBe(BS_EXE);
        expect(env.XR_RUNTIME_JSON).toBe(path.join(BS_EXE, "disabled-openxr.json"));
        expect(env.PARENT_ENV).toBe("1");
        expect(args).toEqual(expect.arrayContaining(["fpfc", "-vrmode", "None"]));
        expect(process.env.VR_OVERRIDE).toBe(parentOpenVr);
        expect(process.env.XR_RUNTIME_JSON).toBe(parentOpenXr);
    });

    it("keeps FPFC runtime suppression when custom launch options select a VR runtime", async () => {
        const { service, ports, wrapper } = buildLauncher();

        const { done } = launch(service, {
            version: { BSVersion: "1.40.0", steam: true },
            launchMods: ["fpfc"],
            command: "VR_OVERRIDE=C:/SteamVR XR_RUNTIME_JSON=C:/SteamVR/steamxr_win64.json",
        });
        await completeUntracked(wrapper, done);

        const { env } = plannedLaunch(ports).plan;
        expect(env.VR_OVERRIDE).toBe(BS_EXE);
        expect(env.XR_RUNTIME_JSON).toBe(path.join(BS_EXE, "disabled-openxr.json"));
    });

    it.each<{ mods: LaunchOption["launchMods"] }>([{ mods: [] }, { mods: ["oculus"] }, { mods: ["oculus", "fpfc"] }])(
        "preserves VR runtime overrides outside headset-free FPFC ($mods)", async ({ mods }) => {
            const { service, ports, wrapper } = buildLauncher();
            const runtimeEnv = { VR_OVERRIDE: "C:/OpenComposite", XR_RUNTIME_JSON: "C:/Oculus/oculus.json" };

            const { done } = launch(service, {
                version: { BSVersion: "1.29.1", steam: true },
                launchMods: mods,
                command: `VR_OVERRIDE=${runtimeEnv.VR_OVERRIDE} XR_RUNTIME_JSON=${runtimeEnv.XR_RUNTIME_JSON}`,
            });
            await completeUntracked(wrapper, done);

            const { env, args } = plannedLaunch(ports).plan;
            expect(env.VR_OVERRIDE).toBe(runtimeEnv.VR_OVERRIDE);
            expect(env.XR_RUNTIME_JSON).toBe(runtimeEnv.XR_RUNTIME_JSON);
            expect(args).not.toContain("None");
        }
    );

    it("launches through Proton without elevation on Linux", async () => {
        const { service, ports, wrapper } = buildLauncher({ platform: "linux" });

        const { done } = launch(service, steamVersion({ command: "gamemoderun %command%", admin: true }));
        await completeUntracked(wrapper, done);

        expect(ports.linux.getProtonConfig).toHaveBeenCalledWith("C:/Steam", { createCompatData: true });
        expect(ports.spawnElevation).not.toHaveBeenCalled();
        expect(log.warn).toHaveBeenCalledWith("Launching as admin is not supported on Linux! Starting the game as a normal user.");
        const { plan, cwd } = plannedLaunch(ports);
        expect(cwd).toBe(BS_FOLDER);
        expect(plan).toMatchObject({
            cmdlet: "gamemoderun",
            args: [`"/proton/proton" run "${BS_EXE}"`],
            env: {
                SteamAppId: "620980",
                STEAM_COMPAT_DATA_PATH: "/bsm/compatdata",
                STEAM_COMPAT_CLIENT_INSTALL_PATH: "C:/Steam",
                OXR_NO_TEXTURE_SOURCE_ALPHA: "1",
            },
        });
        expect(plan.elevated).toBeUndefined();
    });

    it("forwards the launch token to the Flatpak host and owns the matching game", async () => {
        const { service, ports, processes, lifecycle } = buildLauncher({ platform: "linux", flatpak: true, closeOnLaunch: true });
        const linuxGame = game({
            ppid: 777,
            cmd: `wine ${BS_EXE.replaceAll("\\", "/")}`,
            launchToken: "launch-token",
        });
        processes.list.mockResolvedValueOnce([]).mockResolvedValue([linuxGame]);

        const { done } = launch(service, steamVersion());
        await flush();

        const { plan } = plannedLaunch(ports);
        expect(plan.env.BSMANAGER_LAUNCH_TOKEN).toBe("launch-token");
        expect(plan.hostEnvKeys).toContain("BSMANAGER_LAUNCH_TOKEN");
        expect(processes.list).toHaveBeenCalledWith({ name: "Beat Saber.exe", launchToken: "launch-token" });
        expect(lifecycle.quit).toHaveBeenCalledTimes(1);

        processes.list.mockResolvedValue([]);
        await jest.advanceTimersByTimeAsync(1_000);
        await done;
    });
});

describe("SteamLauncherService normal lifecycle", () => {
    it("reports a wrapper spawn failure as BS_EXIT_ERROR", async () => {
        const { service, wrapper } = buildLauncher();

        const { done } = launch(service, steamVersion({ launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"] }));
        await flush();
        wrapper.emit("error", new Error("spawn failed"));

        await expect(done).rejects.toMatchObject({ code: BSLaunchError.BS_EXIT_ERROR, message: "spawn failed" });
    });

    it.each<NodeJS.Platform>(["win32", "linux"])("closes BSManager once the owned game starts and detaches it on quit (%s)", async platform => {
        const { service, ports, processes, lifecycle, wrapper } = buildLauncher({ platform, closeOnLaunch: true });
        const owned = platform === "linux"
            ? game({ ppid: 60, ancestorPids: [60, 42, 1], cmd: `wine ${BS_FOLDER}/Beat Saber.exe` })
            : game();
        processes.list.mockResolvedValueOnce([]).mockResolvedValue([owned]);

        const { done, state } = launch(service, steamVersion());
        await flush();
        expect(lifecycle.quit).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(3_000);
        expect(state.settled).toBe(false);

        lifecycle.emitWillQuit();
        await done;

        expect(lifecycle.quit).toHaveBeenCalledTimes(1);
        expect(wrapper.unref).toHaveBeenCalledTimes(1);
        expect(wrapper.kill).not.toHaveBeenCalled();
        expect(ports.spawnElevation).not.toHaveBeenCalled();
        expect(lifecycle.listenerCount()).toBe(0);
    });

    it("keeps BSManager open when close-on-launch is disabled", async () => {
        const { service, processes, lifecycle } = buildLauncher({ closeOnLaunch: false });
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([game()]).mockResolvedValue([]);

        const { done } = launch(service, steamVersion());
        await flush();
        await jest.advanceTimersByTimeAsync(1_000);
        await done;

        expect(lifecycle.quit).not.toHaveBeenCalled();
    });

    it("does not close before ownership is proven, even after a nonzero wrapper exit", async () => {
        const { service, processes, lifecycle, wrapper } = buildLauncher({ closeOnLaunch: true });
        let resolveAcquisition!: (processes: ProcessInfo[]) => void;
        const concurrent = game({ pid: 86, ppid: 77 });
        processes.list
            .mockResolvedValueOnce([])
            .mockReturnValueOnce(new Promise(resolve => { resolveAcquisition = resolve; }))
            .mockResolvedValueOnce([game(), concurrent])
            .mockResolvedValue([concurrent]);

        const { done, state } = launch(service, steamVersion({ launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"] }));
        await flush();
        wrapper.emit("exit", 7);
        await flush();

        expect(lifecycle.quit).not.toHaveBeenCalled();
        expect(state.settled).toBe(false);

        resolveAcquisition([game(), concurrent]);
        await flush();
        expect(lifecycle.quit).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1_000);
        await done;
    });

    it("completes after an early wrapper success plus the acquisition timeout", async () => {
        const { service, wrapper } = buildLauncher();

        const { done, state } = launch(service, steamVersion());
        await flush();
        wrapper.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(59_000);
        expect(state.settled).toBe(false);

        await jest.advanceTimersByTimeAsync(1_000);
        await done;
    });

    it("completes an unowned launch when the ownership snapshot fails", async () => {
        const { service, ports, processes, wrapper } = buildLauncher();
        processes.list.mockRejectedValue(new Error("process list unavailable"));

        const { done } = launch(service, steamVersion());
        await jest.advanceTimersByTimeAsync(500);

        expect(ports.spawnLaunchPlan).toHaveBeenCalledTimes(1);
        wrapper.emit("exit", 0);
        await done;
    });

    it("fails with BS_EXIT_ERROR when the process table stays unreadable until the acquisition deadline", async () => {
        const { service, processes, wrapper } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockRejectedValue(new Error("process list unavailable"));

        const { done } = launch(service, steamVersion());
        await flush();
        wrapper.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(60_000);

        await expect(done).rejects.toMatchObject({ code: BSLaunchError.BS_EXIT_ERROR, message: "process list unavailable" });
    });

    it("fails with BS_EXIT_ERROR and ends tracking when watching the owned game fails", async () => {
        const { service, processes, lifecycle } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([game()]).mockRejectedValue(new Error("monitor failed"));

        const { done } = launch(service, steamVersion());
        await flush();
        await jest.advanceTimersByTimeAsync(5_000);

        await expect(done).rejects.toMatchObject({ code: BSLaunchError.BS_EXIT_ERROR, message: "monitor failed" });
        expect(lifecycle.listenerCount()).toBe(0);
    });

    it("detaches the wrapper on quit before ownership is known", async () => {
        const { service, processes, lifecycle, wrapper } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockReturnValue(new Promise(() => {
        }));

        const { done } = launch(service, steamVersion());
        await flush();
        lifecycle.emitWillQuit();

        expect(wrapper.unref).toHaveBeenCalledTimes(1);
        expect(lifecycle.quit).not.toHaveBeenCalled();
        expect(lifecycle.listenerCount()).toBe(0);

        wrapper.emit("exit", 0);
        await done;
    });
});

describe("SteamLauncherService elevated lifecycle", () => {
    const adminLaunch = () => steamVersion({ launchMods: ["skip_steam", "fpfc"] as LaunchOption["launchMods"], admin: true });

    it("elevates with shell-free PowerShell and owns only the reported helper's child", async () => {
        const { service, ports, processes, elevation } = buildLauncher();
        processes.list
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([game({ cmd: undefined }), game({ pid: 86, ppid: 84, cmd: undefined })])
            .mockResolvedValue([game({ cmd: undefined })]);

        const { done } = launch(service, adminLaunch());
        await flush();
        reportElevatedHelperPid(elevation, 84);
        await flush();
        elevation.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(2_000);
        await done;

        expect(ports.spawnLaunchPlan).not.toHaveBeenCalled();
        expect(ports.spawnElevation).toHaveBeenCalledWith(
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            expect.any(Array),
            expect.objectContaining({
                cwd: BS_FOLDER,
                detached: true,
                shell: false,
                stdio: ["ignore", "pipe", "ignore"],
                windowsHide: true,
            })
        );
        const encodedScript = (ports.spawnElevation as jest.Mock).mock.calls[0][1][3];
        const script = Buffer.from(encodedScript, "base64").toString("utf16le");
        expect(script).toContain("Start-Process");
        expect(script).toContain("-Verb RunAs");
        expect(script).toContain("FromBase64String");
        expect(script).not.toContain(BS_EXE);
        expect(script).not.toContain("C:\\assets\\scripts\\start_beat_saber_admin.exe");
    });

    it("reports UAC cancellation before the elevated helper starts", async () => {
        const { service, elevation } = buildLauncher();

        const { done } = launch(service, adminLaunch());
        await flush();
        elevation.emit("exit", 1223);
        elevation.emit("close", 1223);

        await expect(done).rejects.toMatchObject({
            code: BSLaunchError.BS_EXIT_ERROR,
            message: expect.stringContaining("exited before reporting the helper PID"),
        });
    });

    it("reports UAC cancellation after elevation stdout ends", async () => {
        const { service, elevation } = buildLauncher();

        const { done } = launch(service, adminLaunch());
        await flush();
        elevation.stdout.emit("end");
        elevation.emit("exit", 1223);
        elevation.emit("close", 1223);

        await expect(done).rejects.toThrow("exited before reporting the helper PID");
    });

    it("reports elevation channel failure after the helper starts", async () => {
        const { service, elevation } = buildLauncher();

        const { done } = launch(service, adminLaunch());
        await flush();
        reportElevatedHelperPid(elevation);
        await flush();
        elevation.emit("error", new Error("elevation channel failed"));

        await expect(done).rejects.toThrow("elevation channel failed");
    });

    it("accepts a helper PID delivered by stdout after the elevation process exit event", async () => {
        const { service, processes, elevation } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([game({ ppid: 84, cmd: undefined })]).mockResolvedValue([]);

        const { done } = launch(service, adminLaunch());
        await flush();
        elevation.emit("exit", 0);
        reportElevatedHelperPid(elevation, 84);
        elevation.stdout.emit("end");
        elevation.emit("close", 0);
        await jest.advanceTimersByTimeAsync(1_000);

        await done;
        expect(processes.list).toHaveBeenCalledTimes(3);
    });

    it("bounds helper PID acquisition and detaches unresolved PowerShell safely", async () => {
        const { service, lifecycle, elevation } = buildLauncher();

        const { done } = launch(service, adminLaunch());
        await flush();
        expect(lifecycle.listenerCount()).toBe(1);
        await jest.advanceTimersByTimeAsync(60_000);

        await expect(done).rejects.toMatchObject({ message: "Elevated helper PID acquisition timed out" });
        expect(elevation.unref).toHaveBeenCalledTimes(1);
        expect(elevation.stdout.destroy).toHaveBeenCalledTimes(1);
        expect(lifecycle.listenerCount()).toBe(0);
    });

    it("continues elevated ownership proof after a nonzero helper result", async () => {
        const { service, processes, elevation } = buildLauncher();
        let resolveAcquisition!: (processes: ProcessInfo[]) => void;
        processes.list.mockResolvedValueOnce([]).mockReturnValueOnce(new Promise(resolve => { resolveAcquisition = resolve; }));

        const { done, state } = launch(service, adminLaunch());
        await flush();
        reportElevatedHelperPid(elevation);
        await flush();
        elevation.emit("exit", 7);
        await flush();
        expect(state.settled).toBe(false);

        resolveAcquisition([]);
        await jest.advanceTimersByTimeAsync(60_000);
        await done;
        expect(log.info).toHaveBeenCalledWith("BS process exit code", 7);
    });

    it("keeps one will-quit listener continuously across helper exit and ownership acquisition", async () => {
        const { service, processes, lifecycle, elevation } = buildLauncher();
        let resolveAcquisition!: (processes: ProcessInfo[]) => void;
        processes.list.mockResolvedValueOnce([]).mockReturnValueOnce(new Promise(resolve => { resolveAcquisition = resolve; }));

        const { done } = launch(service, adminLaunch());
        await flush();
        reportElevatedHelperPid(elevation);
        await flush();
        elevation.emit("exit", 0);
        await flush();

        expect(lifecycle.onWillQuit).toHaveBeenCalledTimes(1);
        expect(lifecycle.listenerCount()).toBe(1);

        resolveAcquisition([]);
        await jest.advanceTimersByTimeAsync(60_000);
        await done;
        expect(lifecycle.listenerCount()).toBe(0);
    });

    it("detaches the helper on quit before elevated ownership is known", async () => {
        const { service, processes, lifecycle, elevation } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockReturnValue(new Promise(() => {
        }));

        const { done } = launch(service, adminLaunch());
        await flush();
        reportElevatedHelperPid(elevation);
        await flush();
        lifecycle.emitWillQuit();

        expect(elevation.unref).toHaveBeenCalledTimes(1);
        expect(elevation.stdout.destroy).toHaveBeenCalledTimes(1);
        expect(lifecycle.quit).not.toHaveBeenCalled();

        elevation.emit("exit", 0);
        await done;
    });

    it("completes an unowned elevated launch when the ownership snapshot is unavailable", async () => {
        const { service, processes, elevation } = buildLauncher();
        processes.list.mockRejectedValue(new Error("process list unavailable"));

        const { done } = launch(service, adminLaunch());
        await jest.advanceTimersByTimeAsync(5_000);
        reportElevatedHelperPid(elevation);
        await flush();
        elevation.emit("exit", 0);

        await expect(done).resolves.toBeUndefined();
    });

    it("closes BSManager for a safely owned elevated process with a hidden path", async () => {
        const { service, processes, lifecycle, elevation } = buildLauncher({ closeOnLaunch: true });
        const owned = game({ ppid: 84, cmd: undefined });
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([owned]).mockResolvedValueOnce([owned]).mockResolvedValue([]);

        const { done } = launch(service, adminLaunch());
        await flush();
        reportElevatedHelperPid(elevation);
        await flush();
        elevation.emit("exit", 0);
        await flush();

        expect(lifecycle.quit).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(2_000);
        await done;
    });

    it("propagates elevated monitoring failures and ends tracking", async () => {
        const { service, processes, lifecycle, elevation } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([game({ ppid: 84, cmd: undefined })])
            .mockRejectedValue(new Error("monitor failed"));

        const { done } = launch(service, adminLaunch());
        await flush();
        reportElevatedHelperPid(elevation);
        elevation.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(5_000);

        await expect(done).rejects.toThrow("monitor failed");
        expect(lifecycle.listenerCount()).toBe(0);
    });
});
