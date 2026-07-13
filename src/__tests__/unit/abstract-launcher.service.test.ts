import { EventEmitter } from "events";
import { AbstractLauncherService, LaunchBeatSaberOptions } from "main/services/bs-launcher/abstract-launcher.service";
import { bsmSpawn } from "main/helpers/os.helpers";
import { ChildProcessWithoutNullStreams } from "child_process";

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
jest.mock("main/constants", () => ({ IS_FLATPAK: false }));

class TestLauncher extends AbstractLauncherService {
    public start(options: LaunchBeatSaberOptions) {
        return this.launchBeatSaber(options);
    }
}

describe("AbstractLauncherService process lifecycle", () => {
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
});
