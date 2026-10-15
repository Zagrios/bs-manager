import { EventEmitter } from "events";
import path from "path";
import { ChildProcess } from "node:child_process";
import { OculusLauncherPorts, OculusLauncherService } from "main/services/bs-launcher/oculus-launcher.service";
import { systemTimers } from "main/services/bs-launcher/owned-process-session";
import { ProcessInfo, ProcessQuery } from "main/helpers/process-table";
import { BSLaunchError, BSLaunchEventData, LaunchOption } from "shared/models/bs-launch";
import { CustomError } from "shared/models/exceptions/custom-error.class";

jest.mock("electron", () => ({ app: { getPath: () => "" } }));
jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("main/services/oculus.service", () => ({ OculusService: { getInstance: jest.fn() } }));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: jest.fn() } }));
jest.mock("main/services/static-configuration.service", () => ({ StaticConfigurationService: { getInstance: jest.fn() } }));

const BS_FOLDER = "C:/Beat Saber";
const BS_EXE = path.join(BS_FOLDER, "Beat Saber.exe");
const launchedAt = new Date("2026-07-13T08:00:00.000Z");
const launchOptions: LaunchOption = { version: { BSVersion: "1.29.1", oculus: true } };

const game = (overrides: Partial<ProcessInfo> = {}): ProcessInfo => ({
    pid: 85,
    ppid: 42,
    name: "Beat Saber.exe",
    cmd: BS_EXE,
    startTime: new Date("2026-07-13T08:00:00.001Z"),
    ...overrides,
});

function wrapperProcess(): ChildProcess & { unref: jest.Mock } {
    return Object.assign(new EventEmitter(), { exitCode: null, killed: false, pid: 42, stdout: null, unref: jest.fn() }) as never;
}

function buildLauncher(options: { closeOnLaunch?: boolean } = {}) {
    const processes = { list: jest.fn<Promise<ProcessInfo[]>, [ProcessQuery]>().mockResolvedValue([]) };
    const wrapper = wrapperProcess();
    const listeners = new Set<() => void>();
    const lifecycle = {
        onWillQuit: jest.fn((listener: () => void) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        }),
        quit: jest.fn(),
    };
    const ports: OculusLauncherPorts = {
        session: {
            processes,
            timers: systemTimers,
            lifecycle,
            platform: "win32",
            flatpak: false,
            newLaunchToken: () => "unused",
        },
        env: {},
        localVersions: { getInstalledVersionPath: jest.fn(async () => BS_FOLDER) },
        pathExists: jest.fn(async () => true),
        spawnLaunchPlan: jest.fn(() => wrapper),
        isCloseOnLaunchEnabled: () => options.closeOnLaunch ?? false,
        oculus: { startOculus: jest.fn(async (): Promise<void> => undefined) },
    };
    return { service: new OculusLauncherService(ports), ports, processes, lifecycle, wrapper };
}

function launch(service: OculusLauncherService) {
    const events: BSLaunchEventData[] = [];
    const state = { completed: false };
    const done = new Promise<void>((resolve, reject) => {
        service.launch(launchOptions).subscribe({
            next: event => events.push(event),
            complete: () => { state.completed = true; resolve(); },
            error: reject,
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

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: launchedAt });
});

afterEach(() => {
    jest.useRealTimers();
});

describe("OculusLauncherService owned process lifecycle", () => {
    it("binds completion to the safely owned Oculus process, not to the wrapper", async () => {
        const { service, ports, processes, wrapper } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValue([game()]);

        const { done, events, state } = launch(service);
        await flush();

        expect(processes.list).toHaveBeenNthCalledWith(1, { commandLine: "Beat Saber.exe" });
        expect(processes.list).toHaveBeenNthCalledWith(2, { name: "Beat Saber.exe" });
        expect(ports.spawnLaunchPlan).toHaveBeenCalledWith(
            expect.objectContaining({ cmdlet: `"${BS_EXE}"`, args: [] }),
            BS_FOLDER
        );
        expect(events).toEqual([{ type: "BS_LAUNCHING" }]);

        wrapper.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(3_000);
        expect(state.completed).toBe(false);

        processes.list.mockResolvedValue([]);
        await jest.advanceTimersByTimeAsync(1_000);
        await done;
    });

    it("refuses a second instance of Beat Saber", async () => {
        const { service, ports, processes } = buildLauncher();
        processes.list.mockResolvedValueOnce([{ pid: 85, name: "Beat Saber.exe" }]);

        const { done } = launch(service);

        await expect(done).rejects.toMatchObject({ code: BSLaunchError.BS_ALREADY_RUNNING });
        expect(ports.spawnLaunchPlan).not.toHaveBeenCalled();
    });

    it("propagates Oculus start errors it understands and forces the launch otherwise", async () => {
        const first = buildLauncher();
        (first.ports.oculus.startOculus as jest.Mock).mockRejectedValue(
            new CustomError("Oculus not installed", BSLaunchError.OCULUS_NOT_INSTALLED)
        );
        await expect(launch(first.service).done).rejects.toMatchObject({ code: BSLaunchError.OCULUS_NOT_INSTALLED });

        const second = buildLauncher();
        (second.ports.oculus.startOculus as jest.Mock).mockRejectedValue(new Error("client crashed"));
        const { done } = launch(second.service);
        await flush();
        expect(second.ports.spawnLaunchPlan).toHaveBeenCalledTimes(1);
        second.wrapper.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(60_000);
        await done;
    });

    it("fails safe when ownership is unavailable, following the wrapper instead of another process", async () => {
        const { service, processes, wrapper } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValue([game({ ppid: 77 })]);

        const { done } = launch(service);
        await flush();
        wrapper.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(60_000);

        await expect(done).resolves.toBeUndefined();
    });

    it("falls back to the wrapper when the process table stays unreadable", async () => {
        const { service, processes, wrapper } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockRejectedValue(new Error("process list unavailable"));

        const { done } = launch(service);
        await flush();
        wrapper.emit("exit", 0);
        await jest.advanceTimersByTimeAsync(60_000);

        await expect(done).resolves.toBeUndefined();
    });

    it("preserves BS_EXIT_ERROR when the wrapper fails without an owned process", async () => {
        const { service, wrapper } = buildLauncher();
        const wrapperError = new Error("wrapper failure");

        const { done } = launch(service);
        await flush();
        wrapper.emit("error", wrapperError);

        await expect(done).rejects.toMatchObject({ code: BSLaunchError.BS_EXIT_ERROR, message: wrapperError.message });
    });

    it("ignores a late wrapper error once the owned process is being followed", async () => {
        const { service, processes, wrapper } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([game()]).mockResolvedValue([]);

        const { done } = launch(service);
        await flush();
        wrapper.emit("error", new Error("late wrapper failure"));
        await jest.advanceTimersByTimeAsync(1_000);

        await expect(done).resolves.toBeUndefined();
    });

    it("reports UNKNOWN_ERROR when watching the owned process fails", async () => {
        const { service, processes } = buildLauncher();
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([game()])
            .mockRejectedValue(new Error("monitor failed"));

        const { done } = launch(service);
        await flush();
        await jest.advanceTimersByTimeAsync(5_000);

        await expect(done).rejects.toMatchObject({ code: BSLaunchError.UNKNOWN_ERROR, message: "monitor failed" });
    });

    it("closes BSManager once the owned Oculus process starts", async () => {
        const { service, processes, lifecycle } = buildLauncher({ closeOnLaunch: true });
        processes.list.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([game()]).mockResolvedValue([]);

        const { done } = launch(service);
        await flush();
        expect(lifecycle.quit).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1_000);
        await done;
    });
});
