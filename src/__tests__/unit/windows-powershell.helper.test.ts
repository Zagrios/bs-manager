import { execFile } from "child_process";
import { getWindowsPowerShellPath, getWindowsProcessesByName } from "main/helpers/windows-powershell.helper";

jest.mock("child_process", () => ({
    execFile: jest.fn(),
}));

describe("getWindowsPowerShellPath", () => {
    const originalSystemRoot = process.env.SystemRoot;

    afterEach(() => {
        jest.clearAllMocks();
        if (originalSystemRoot === undefined) {
            delete process.env.SystemRoot;
        } else {
            process.env.SystemRoot = originalSystemRoot;
        }
    });

    it("rejects malformed absolute SystemRoot values", () => {
        process.env.SystemRoot = "C:\\Windows\"; ignored";

        expect(() => getWindowsPowerShellPath()).toThrow("SystemRoot");
    });

    it("enumerates PID, executable path, and start-time evidence without a shell", async () => {
        process.env.SystemRoot = "C:\\Windows";
        (execFile as unknown as jest.Mock).mockImplementationOnce((_file, args, _options, callback) => {
            const script = Buffer.from(args[3], "base64").toString("utf16le");
            expect(script).toContain("Get-CimInstance Win32_Process");
            expect(script).toContain("$_.ExecutablePath");
            expect(script).toContain("$_.CreationDate.ToUniversalTime()");
            callback(null, JSON.stringify([{
                pid: 85,
                ppid: 42,
                name: "Beat Saber.exe",
                cmd: "C:\\Beat Saber\\Beat Saber.exe",
                startTime: "2026-07-13T08:00:00.123Z",
            }]), "");
        });

        await expect(getWindowsProcessesByName("Beat Saber.exe")).resolves.toEqual([{
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "C:\\Beat Saber\\Beat Saber.exe",
            startTime: "2026-07-13T08:00:00.123Z",
        }]);
        expect(execFile).toHaveBeenCalledWith(
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            expect.any(Array),
            expect.objectContaining({ shell: false, timeout: expect.any(Number) }),
            expect.any(Function)
        );
    });
});
