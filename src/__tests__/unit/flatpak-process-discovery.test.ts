import cp from "child_process";
import log from "electron-log";
import psList from "ps-list";
import { BsmShellLog, bsmSpawn, getProcessesByName } from "main/helpers/os.helpers";

jest.mock("electron-log", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
jest.mock("main/constants", () => ({ IS_FLATPAK: true }));
jest.mock("child_process", () => ({
    ...jest.requireActual("child_process"),
    exec: jest.fn(),
    execFile: jest.fn(),
    spawn: jest.fn(),
}));
jest.mock("ps-list", () => jest.fn());

const originalPlatform = process.platform;

beforeAll(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
});

afterAll(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: originalPlatform });
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe("Flatpak host process discovery", () => {
    const hostRecord = (pid: number, token: string, command: string) => [
        pid,
        60,
        60,
        "Mon",
        "Jul",
        13,
        "08:00:01",
        2026,
        Buffer.from(command).toString("base64"),
        Buffer.from(token).toString("base64"),
    ].join("\t");

    it("accepts launch token only from authoritative same-user host environment", async () => {
        const output = [
            hostRecord(85, "owned-token", "wine /games/Beat Saber/Beat Saber.exe fpfc"),
            hostRecord(86, "", "wine /games/Beat Saber/Beat Saber.exe fpfc BSMANAGER_LAUNCH_TOKEN=argv-only-token"),
        ].join("\n");
        (cp.exec as unknown as jest.Mock).mockImplementation((_command, _options, callback) => {
            callback(null, output, "");
            return {};
        });

        const processes = await getProcessesByName("Beat Saber.exe");

        expect(cp.exec).toHaveBeenCalledWith(
            expect.stringContaining("flatpak-spawn --host"),
            expect.any(Object),
            expect.any(Function)
        );
        const command = (cp.exec as unknown as jest.Mock).mock.calls[0][0];
        expect(command).toMatch(/flatpak-spawn --host\s+sh -c/);
        expect(command).toContain("/proc/");
        expect(command).toContain("/environ");
        expect(command).toContain("stat -c %u");
        expect(command).toContain("id -u");
        expect(command).toContain("/bin/ps");
        expect(command).not.toContain("ps eww");
        expect(psList).not.toHaveBeenCalled();
        expect(processes).toEqual([{
            pid: 85,
            ppid: 60,
            processGroupId: 60,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc",
            startTime: new Date("2026-07-13T08:00:01.000Z"),
            launchToken: "owned-token",
        }, {
            pid: 86,
            ppid: 60,
            processGroupId: 60,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc BSMANAGER_LAUNCH_TOKEN=argv-only-token",
            startTime: new Date("2026-07-13T08:00:01.000Z"),
        }]);

        await expect(getProcessesByName("Beat Saber.exe", "argv-only-token")).resolves.toEqual([]);
    });

    it("keeps Flatpak launch token out of command logs", () => {
        const launchToken = "private-test-launch-token";
        bsmSpawn("proton", {
            options: { env: { BSMANAGER_LAUNCH_TOKEN: launchToken } },
            log: BsmShellLog.Command,
            flatpak: { host: true, env: ["BSMANAGER_LAUNCH_TOKEN"] },
        });

        expect(cp.spawn).toHaveBeenCalledWith(expect.stringContaining(launchToken), expect.anything());
        expect(JSON.stringify((log.info as jest.Mock).mock.calls)).not.toContain(launchToken);
        expect(JSON.stringify((log.info as jest.Mock).mock.calls)).toContain("[REDACTED]");
    });
});
