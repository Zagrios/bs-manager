import { EventEmitter } from "events";
import { AbstractLauncherService, LaunchBeatSaberOptions } from "main/services/bs-launcher/abstract-launcher.service";
import { bsmSpawn } from "main/helpers/os.helpers";
import { ChildProcessWithoutNullStreams } from "child_process";
import { app } from "electron";
import { focusProcessWindow } from "main/helpers/focus-process-window.helper";
import { StaticConfigurationService } from "main/services/static-configuration.service";

jest.mock("electron", () => {
    const events = new (jest.requireActual("events").EventEmitter)();
    return {
        app: {
            on: events.on.bind(events),
            removeListener: events.removeListener.bind(events),
            quit: jest.fn(),
        },
    };
});
jest.mock("electron-log", () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock("main/helpers/os.helpers", () => ({
    BsmShellLog: { Command: 1 },
    bsmSpawn: jest.fn(),
}));
jest.mock("main/services/linux.service", () => ({ LinuxService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/static-configuration.service", () => ({ StaticConfigurationService: { getInstance: jest.fn(() => ({ get: jest.fn(() => false) })) } }));
jest.mock("main/helpers/focus-process-window.helper", () => ({ focusProcessWindow: jest.fn(() => Promise.resolve("window-found")) }));
jest.mock("main/constants", () => ({ BS_EXECUTABLE: "Beat Saber.exe", IS_FLATPAK: false }));

class TestLauncher extends AbstractLauncherService {
    public start(options: LaunchBeatSaberOptions) {
        return this.launchBeatSaber(options);
    }

    public spawn(options: LaunchBeatSaberOptions) {
        return this.launchBeatSaberProcess(options);
    }
}

describe("AbstractLauncherService process lifecycle", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (focusProcessWindow as jest.Mock).mockImplementation((_path, options) => {
            options.onWindowReady?.();
            return Promise.resolve("window-found");
        });
    });

    it("keeps Oculus-style launches pending until Beat Saber exits", async () => {
        const process = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 42,
            unref: jest.fn(),
        }) as unknown as ChildProcessWithoutNullStreams;
        (bsmSpawn as jest.Mock).mockReturnValue(process);
        const launcher = new TestLauncher();

        let settled = false;
        const exit = launcher.start({
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:\\Beat Saber",
        }).exit.then(code => {
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
        (bsmSpawn as jest.Mock).mockReturnValue(new EventEmitter());
        const launcher = new TestLauncher();

        launcher.spawn({
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:\\Beat Saber",
        });

        expect(bsmSpawn).toHaveBeenCalledWith("Beat Saber.exe", expect.objectContaining({
            options: expect.objectContaining({
                detached: true,
                stdio: "ignore",
            }),
        }));
    });

    it.each([true, false])("respects close-after-launch when the toggle is %s", async enabled => {
        const process = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 42,
            unref: jest.fn(),
        }) as unknown as ChildProcessWithoutNullStreams;
        (bsmSpawn as jest.Mock).mockReturnValue(process);
        (StaticConfigurationService.getInstance as jest.Mock).mockReturnValue({
            get: jest.fn(() => enabled),
        });
        const launcher = new TestLauncher();

        const { exit } = launcher.start({
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:\\Beat Saber",
        });
        await Promise.resolve();
        await Promise.resolve();

        expect(process.unref).toHaveBeenCalledTimes(enabled ? 1 : 0);
        expect(app.quit).toHaveBeenCalledTimes(enabled ? 1 : 0);
        expect((focusProcessWindow as jest.Mock).mock.calls[0][1].signal.aborted).toBe(enabled);

        process.emit("exit", 0);
        await expect(exit).resolves.toBe(0);
    });

    it("does not auto-close from a window result delivered after the owned process exits", async () => {
        const process = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 42,
            unref: jest.fn(),
        }) as unknown as ChildProcessWithoutNullStreams;
        (bsmSpawn as jest.Mock).mockReturnValue(process);
        (StaticConfigurationService.getInstance as jest.Mock).mockReturnValue({
            get: jest.fn(() => true),
        });
        let reportWindowReady: () => void;
        (focusProcessWindow as jest.Mock).mockImplementation((_path, options) => new Promise(resolve => {
            reportWindowReady = () => {
                options.onWindowReady?.();
                resolve("window-found");
            };
        }));
        const launcher = new TestLauncher();

        const { exit } = launcher.start({
            cmdlet: "Beat Saber.exe",
            env: {},
            customEnv: {},
            beatSaberFolderPath: "C:\\Beat Saber",
        });
        process.emit("exit", 0);
        await expect(exit).resolves.toBe(0);
        reportWindowReady!();
        await Promise.resolve();

        const focusOptions = (focusProcessWindow as jest.Mock).mock.calls[0][1];
        expect(focusOptions.processId).toBe(42);
        expect(focusOptions.signal.aborted).toBe(true);
        expect(process.unref).not.toHaveBeenCalled();
        expect(app.quit).not.toHaveBeenCalled();
    });
});
