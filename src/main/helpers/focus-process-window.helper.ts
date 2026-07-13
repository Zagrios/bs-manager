import { execFile } from "child_process";

export type FocusProcessWindowResult = "focused" | "window-found" | "not-found";

export type FocusProcessWindowOptions = {
    launchedAfter?: Date;
    pollIntervalMs?: number;
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

$process = Get-Process -Name "Beat Saber" -ErrorAction SilentlyContinue |
    Where-Object {
        try {
            $_.Path -ieq $TargetExecutablePath -and
                $_.StartTime.ToUniversalTime() -ge $LaunchStartedAfterUtc
        }
        catch {
            $false
        }
    } |
    Sort-Object StartTime -Descending |
    Select-Object -First 1

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

function runFocusAttempt(encodedScript: string): Promise<FocusProcessWindowResult> {
    return new Promise(resolve => {
        execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript], {
            encoding: "utf8",
            windowsHide: true,
            timeout: 5_000,
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

function delay(timeoutMs: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, timeoutMs);
    });
}

/**
 * Waits for the main window of a newly started process and attempts to activate it.
 * Windows can refuse foreground activation, so callers should treat "window-found"
 * as a successful launch even when the focus request was denied.
 */
export async function focusProcessWindow(executablePath?: string, options: FocusProcessWindowOptions = {}): Promise<FocusProcessWindowResult> {
    if (process.platform !== "win32" || !executablePath) {
        return "not-found";
    }

    const encodedExecutablePath = Buffer.from(executablePath, "utf8").toString("base64");
    const launchedAfterUtc = (options.launchedAfter ?? new Date(0)).toISOString();
    const script = `$TargetExecutablePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedExecutablePath}'))\n$LaunchStartedAfterUtc = [DateTime]::Parse('${launchedAfterUtc}').ToUniversalTime()\n${FOCUS_PROCESS_WINDOW_SCRIPT}`;
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;
    let windowFound = false;

    do {
        const result = await runFocusAttempt(encodedScript);
        if (result === "focused") {
            return "focused";
        }
        windowFound ||= result === "window-found";

        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
            break;
        }
        await delay(Math.min(pollIntervalMs, remainingMs));
    } while (Date.now() < deadline);

    return windowFound ? "window-found" : "not-found";
}
