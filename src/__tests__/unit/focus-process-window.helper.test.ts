import { execFile } from "child_process";
import { focusProcessWindow } from "main/helpers/focus-process-window.helper";

jest.mock("child_process", () => ({
    execFile: jest.fn(),
}));

const execFileMock = execFile as unknown as jest.Mock;

function replyWith(stdout: string): void {
    execFileMock.mockImplementationOnce((_file, _args, _options, callback) => {
        callback(null, stdout, "");
    });
}

describe("focusProcessWindow", () => {
    const originalPlatform = process.platform;

    beforeAll(() => {
        Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
    });

    afterAll(() => {
        Object.defineProperty(process, "platform", { configurable: true, value: originalPlatform });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("keeps polling when the newly launched process creates its window late", async () => {
        jest.useFakeTimers({ now: new Date("2026-07-13T08:00:00.000Z") });
        const readyAt = Date.now() + 20_000;
        execFileMock.mockImplementation((_file, _args, _options, callback) => {
            callback(null, Date.now() >= readyAt ? "focused\n" : "not-found\n", "");
        });

        const result = focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter: new Date(0),
            pollIntervalMs: 1_000,
        });
        await jest.advanceTimersByTimeAsync(20_001);

        await expect(result).resolves.toBe("focused");
        expect(execFileMock).toHaveBeenCalledTimes(21);
    });

    it("ignores an existing matching process that started before this launch", async () => {
        const launchedAfter = new Date("2026-07-13T08:00:00.000Z");
        execFileMock.mockImplementationOnce((_file, args, _options, callback) => {
            const script = Buffer.from(args[3], "base64").toString("utf16le");
            const selectsNewProcess = script.includes(launchedAfter.toISOString())
                && script.includes("$_.StartTime.ToUniversalTime() -ge $LaunchStartedAfterUtc");
            callback(null, selectsNewProcess ? "focused\n" : "window-found\n", "");
        });

        await expect(focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter,
            pollIntervalMs: 1,
            timeoutMs: 100,
        })).resolves.toBe("focused");
    });

    it("retries focus when SetForegroundWindow fails before succeeding", async () => {
        replyWith("window-found\n");
        replyWith("focused\n");

        await expect(focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter: new Date(0),
            pollIntervalMs: 1,
            timeoutMs: 100,
        })).resolves.toBe("focused");

        expect(execFileMock).toHaveBeenCalledTimes(2);
    });

    it("returns window-found cleanly when every focus attempt is denied", async () => {
        jest.useFakeTimers();
        execFileMock.mockImplementation((_file, _args, _options, callback) => {
            callback(null, "window-found\n", "");
        });

        const result = focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter: new Date(0),
            pollIntervalMs: 10,
            timeoutMs: 100,
        });
        await jest.advanceTimersByTimeAsync(100);

        await expect(result).resolves.toBe("window-found");
        expect(execFileMock).toHaveBeenCalledTimes(10);
    });

    it("only reports focused after confirming the foreground window", async () => {
        execFileMock.mockImplementationOnce((_file, args, _options, callback) => {
            const script = Buffer.from(args[3], "base64").toString("utf16le");
            const confirmsForeground = script.includes("GetForegroundWindow")
                && script.includes("[BSManagerWindowApi]::GetForegroundWindow() -eq $process.MainWindowHandle");
            callback(null, confirmsForeground ? "focused\n" : "window-found\n", "");
        });

        await expect(focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter: new Date(0),
            timeoutMs: 0,
        })).resolves.toBe("focused");
    });

    it("restores a minimized window without restoring a maximized window", async () => {
        execFileMock.mockImplementationOnce((_file, args, _options, callback) => {
            const script = Buffer.from(args[3], "base64").toString("utf16le");
            const restoresOnlyWhenMinimized = script.includes("IsIconic")
                && script.includes("if ([BSManagerWindowApi]::IsIconic($process.MainWindowHandle))")
                && script.lastIndexOf("ShowWindowAsync") > script.indexOf("if ([BSManagerWindowApi]::IsIconic");
            callback(null, restoresOnlyWhenMinimized ? "focused\n" : "window-found\n", "");
        });

        await expect(focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter: new Date(0),
            timeoutMs: 0,
        })).resolves.toBe("focused");
    });
});
