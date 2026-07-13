import { execFile } from "child_process";
import { getWindowsPowerShellPath } from "./windows-powershell.helper";

export type FocusProcessWindowResult = "focused" | "window-found" | "not-found";

export type FocusProcessWindowOptions = {
    launchedAfter?: Date;
    onWindowReady?: () => void;
    processId?: number;
    processStartedAt?: Date;
    pollIntervalMs?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
};

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 60_000;

const FOCUS_PROCESS_WINDOW_SCRIPT = `
$nativeMethods = @'
using System;
using System.Runtime.InteropServices;

public static class BSManagerWindowApi {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
'@

Add-Type -TypeDefinition $nativeMethods

$process = Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue

if ($null -ne $process) {
    try {
        $processStartedAtUtc = $process.StartTime.ToUniversalTime()
        $startTimeDoesNotMatch = if ($null -ne $TargetProcessStartedAtUtc) {
            $processStartedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") -ne
                $TargetProcessStartedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
        else {
            $processStartedAtUtc -lt $LaunchStartedAfterUtc
        }

        if ($process.Path -ine $TargetExecutablePath -or $startTimeDoesNotMatch) {
            $process = $null
        }
    }
    catch {
        $process = $null
    }
}

if ($null -ne $process -and $process.MainWindowHandle -ne 0) {
    if ([BSManagerWindowApi]::IsIconic($process.MainWindowHandle)) {
        [BSManagerWindowApi]::ShowWindowAsync($process.MainWindowHandle, 9) | Out-Null
    }

    $focusRequested = [BSManagerWindowApi]::SetForegroundWindow($process.MainWindowHandle)
    if ($focusRequested -and [BSManagerWindowApi]::GetForegroundWindow() -eq $process.MainWindowHandle) {
        Write-Output "focused"
    }
    else {
        Write-Output "window-found"
    }

    exit 0
}

Write-Output "not-found"
`;

function runFocusAttempt(encodedScript: string, timeoutMs: number, signal?: AbortSignal): Promise<FocusProcessWindowResult> {
    return new Promise(resolve => {
        execFile(getWindowsPowerShellPath(), ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript], {
            encoding: "utf8",
            shell: false,
            signal,
            windowsHide: true,
            timeout: Math.min(5_000, timeoutMs),
        }, (error, stdout) => {
            if (error) {
                resolve("not-found");
                return;
            }

            const result = stdout.trim();
            resolve(result === "focused" || result === "window-found" ? result : "not-found");
        });
    });
}

function delay(timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
    return new Promise(resolve => {
        if (signal?.aborted) {
            resolve(false);
            return;
        }

        let settled = false;
        const finish = (completed: boolean) => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            resolve(completed);
        };
        const onAbort = () => finish(false);
        const timer = setTimeout(() => finish(true), timeoutMs);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

/**
 * Waits for the main window of a newly started process and attempts to activate it.
 * Windows can refuse foreground activation, so callers should treat "window-found"
 * as a successful launch even when the focus request was denied.
 */
export async function focusProcessWindow(executablePath?: string, options: FocusProcessWindowOptions = {}): Promise<FocusProcessWindowResult> {
    if (process.platform !== "win32" || !executablePath || !Number.isSafeInteger(options.processId) || options.processId <= 0) {
        return "not-found";
    }

    const encodedExecutablePath = Buffer.from(executablePath, "utf8").toString("base64");
    const launchedAfterUtc = (options.launchedAfter ?? new Date(0)).toISOString();
    const { processStartedAt } = options;
    const processStartedAtAssignment = processStartedAt
        ? `[DateTime]::Parse('${processStartedAt.toISOString()}').ToUniversalTime()`
        : "$null";
    const script = `$TargetExecutablePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedExecutablePath}'))\n$TargetProcessId = ${options.processId}\n$TargetProcessStartedAtUtc = ${processStartedAtAssignment}\n$LaunchStartedAfterUtc = [DateTime]::Parse('${launchedAfterUtc}').ToUniversalTime()\n${FOCUS_PROCESS_WINDOW_SCRIPT}`;
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;
    let windowFound = false;
    let windowReadyReported = false;

    while (!options.signal?.aborted) {
        const attemptBudgetMs = deadline - Date.now();
        if (attemptBudgetMs <= 0) {
            break;
        }
        if (options.signal?.aborted) {
            break;
        }
        const result = await runFocusAttempt(encodedScript, attemptBudgetMs, options.signal);
        if (!windowReadyReported && result !== "not-found") {
            windowReadyReported = true;
            options.onWindowReady?.();
        }
        if (result === "focused") {
            return "focused";
        }
        windowFound ||= result === "window-found";

        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
            break;
        }
        if (!(await delay(Math.min(pollIntervalMs, remainingMs), options.signal))) {
            break;
        }
    }

    return windowFound ? "window-found" : "not-found";
}
