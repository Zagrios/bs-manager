import cp from "child_process";
import psList from "ps-list";
import { getProcessesByName } from "main/helpers/os.helpers";

jest.mock("electron-log", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
jest.mock("main/constants", () => ({ IS_FLATPAK: true }));
jest.mock("child_process", () => ({
    ...jest.requireActual("child_process"),
    exec: jest.fn(),
    execFile: jest.fn(),
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
    it("enumerates host processes and returns exact launch-token provenance", async () => {
        const output = [
            "  85 60 60 Mon Jul 13 08:00:01 2026 Beat Saber.exe wine /games/Beat Saber/Beat Saber.exe fpfc BSMANAGER_LAUNCH_TOKEN=owned-token",
            "  86 77 77 Mon Jul 13 08:00:02 2026 Beat Saber.exe wine /games/Beat Saber/Beat Saber.exe fpfc BSMANAGER_LAUNCH_TOKEN=concurrent-token",
            "  90 1 90 Mon Jul 13 08:00:03 2026 other ps helper",
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
        expect(command).toContain("env LC_ALL=C TZ=UTC ps eww");
        expect(command).toContain("grep -F");
        expect(psList).not.toHaveBeenCalled();
        expect(processes).toEqual([{
            pid: 85,
            ppid: 60,
            processGroupId: 60,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc BSMANAGER_LAUNCH_TOKEN=owned-token",
            startTime: new Date("2026-07-13T08:00:01.000Z"),
            launchToken: "owned-token",
        }, {
            pid: 86,
            ppid: 77,
            processGroupId: 77,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc BSMANAGER_LAUNCH_TOKEN=concurrent-token",
            startTime: new Date("2026-07-13T08:00:02.000Z"),
            launchToken: "concurrent-token",
        }]);
    });
});
