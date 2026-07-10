import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type FocusProcessWindowResult = "focused" | "window-found" | "not-found";

const FOCUS_PROCESS_WINDOW_SCRIPT = `
$nativeMethods = @'
using System;
using System.Runtime.InteropServices;

public static class BSManagerWindowApi {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
'@

Add-Type -TypeDefinition $nativeMethods

for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $process = Get-Process -Name "Beat Saber" -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -ieq $TargetExecutablePath } |
        Select-Object -First 1

    if ($null -ne $process -and $process.MainWindowHandle -ne 0) {
        [BSManagerWindowApi]::ShowWindowAsync($process.MainWindowHandle, 9) | Out-Null

        if ([BSManagerWindowApi]::SetForegroundWindow($process.MainWindowHandle)) {
            Write-Output "focused"
        }
        else {
            Write-Output "window-found"
        }

        exit 0
    }

    Start-Sleep -Milliseconds 500
}

exit 2
`;

/**
 * Waits for the main window of a newly started process and attempts to activate it.
 * Windows can refuse foreground activation, so callers should treat "window-found"
 * as a successful launch even when the focus request was denied.
 */
export async function focusProcessWindow(executablePath?: string): Promise<FocusProcessWindowResult> {
    if (process.platform !== "win32" || !executablePath) {
        return "not-found";
    }

    try {
        const encodedExecutablePath = Buffer.from(executablePath, "utf8").toString("base64");
        const script = `$TargetExecutablePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedExecutablePath}'))\n${FOCUS_PROCESS_WINDOW_SCRIPT}`;
        const encodedScript = Buffer.from(script, "utf16le").toString("base64");
        const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript], {
            windowsHide: true,
            timeout: 16_000,
        });

        return stdout.trim() === "focused" ? "focused" : "window-found";
    } catch {
        return "not-found";
    }
}
