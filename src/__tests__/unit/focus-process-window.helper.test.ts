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
    const originalSystemRoot = process.env.SystemRoot;

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
            processId: 42,
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
            processId: 42,
            pollIntervalMs: 1,
            timeoutMs: 100,
        })).resolves.toBe("focused");
    });

    it("binds every window attempt to the owned process PID and launch token", async () => {
        const launchedAfter = new Date("2026-07-13T08:00:00.000Z");
        const processStartedAt = new Date("2026-07-13T08:00:00.123Z");
        execFileMock.mockImplementationOnce((_file, args, _options, callback) => {
            const script = Buffer.from(args[3], "base64").toString("utf16le");
            const targetsOwnedProcess = script.includes("$TargetProcessId = 42")
                && script.includes("Get-Process -Id $TargetProcessId")
                && !script.includes("Get-Process -Name \"Beat Saber\"")
                && script.includes(launchedAfter.toISOString())
                && script.includes(processStartedAt.toISOString())
                && script.includes("$processStartedAtUtc.ToString(\"yyyy-MM-ddTHH:mm:ss.fffZ\") -ne");
            callback(null, targetsOwnedProcess ? "focused\n" : "window-found\n", "");
        });

        await expect(focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter,
            processId: 42,
            processStartedAt,
            timeoutMs: 100,
        } as any)).resolves.toBe("focused");
        expect(execFileMock).toHaveBeenCalledWith(
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            expect.any(Array),
            expect.objectContaining({ shell: false }),
            expect.any(Function)
        );
    });

    it("cancels window polling when the owned process lifecycle ends", async () => {
        jest.useFakeTimers();
        const ownership = new AbortController();
        execFileMock.mockImplementation((_file, _args, _options, callback) => {
            callback(null, "not-found\n", "");
        });

        const result = focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter: new Date(0),
            processId: 42,
            pollIntervalMs: 1_000,
            timeoutMs: 60_000,
            signal: ownership.signal,
        } as any);
        await Promise.resolve();
        ownership.abort();
        await jest.runAllTimersAsync();

        await expect(result).resolves.toBe("not-found");
        expect(execFileMock).toHaveBeenCalledTimes(1);
    });

    it("reports window readiness before continuing focus retries", async () => {
        jest.useFakeTimers();
        const onWindowReady = jest.fn();
        replyWith("window-found\n");
        replyWith("focused\n");

        const result = focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter: new Date(0),
            processId: 42,
            pollIntervalMs: 1_000,
            timeoutMs: 5_000,
            onWindowReady,
        } as any);
        await Promise.resolve();
        await Promise.resolve();

        expect(onWindowReady).toHaveBeenCalledTimes(1);
        expect(execFileMock).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1_000);
        await expect(result).resolves.toBe("focused");
        expect(onWindowReady).toHaveBeenCalledTimes(1);
    });

    it("starts no focus attempt when the deadline budget is exhausted", async () => {
        execFileMock.mockImplementation((_file, _args, _options, callback) => {
            callback(null, "not-found\n", "");
        });

        await expect(focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter: new Date(0),
            processId: 42,
            timeoutMs: 0,
        })).resolves.toBe("not-found");

        expect(execFileMock).not.toHaveBeenCalled();
    });

    it("passes only the remaining deadline budget to each focus attempt", async () => {
        jest.useFakeTimers();
        const attemptTimeouts: number[] = [];
        execFileMock.mockImplementation((_file, _args, options, callback) => {
            attemptTimeouts.push(options.timeout);
            setTimeout(() => callback(null, "not-found\n", ""), Math.min(400, options.timeout));
        });

        const result = focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter: new Date(0),
            processId: 42,
            pollIntervalMs: 100,
            timeoutMs: 750,
        });
        await jest.advanceTimersByTimeAsync(750);

        await expect(result).resolves.toBe("not-found");
        expect(attemptTimeouts).toEqual([750, 250]);
    });

    it("retries focus when SetForegroundWindow fails before succeeding", async () => {
        replyWith("window-found\n");
        replyWith("focused\n");

        await expect(focusProcessWindow("C:\\Beat Saber\\Beat Saber.exe", {
            launchedAfter: new Date(0),
            processId: 42,
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
            processId: 42,
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
            processId: 42,
            timeoutMs: 100,
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
            processId: 42,
            timeoutMs: 100,
        })).resolves.toBe("focused");
    });
});
