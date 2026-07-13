import path from "path";
import { execFile } from "child_process";

const WINDOWS_POWERSHELL_RELATIVE_PATH = [
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
];

const WINDOWS_PROCESS_LIST_TIMEOUT_MS = 2_000;

const WINDOWS_PROCESS_LIST_SCRIPT = `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$escapedProcessName = $TargetProcessName.Replace("'", "''")
$processes = @(Get-CimInstance Win32_Process -Filter "Name = '$escapedProcessName'" -ErrorAction Stop |
    ForEach-Object {
        $startedAt = $null
        try {
            $startedAt = $_.CreationDate.ToUniversalTime().ToString("o")
        }
        catch {
        }

        [PSCustomObject]@{
            pid = [int]$_.ProcessId
            ppid = [int]$_.ParentProcessId
            name = $_.Name
            cmd = $_.ExecutablePath
            startTime = $startedAt
        }
    })

ConvertTo-Json -InputObject $processes -Compress
`;

export type WindowsProcessDetails = {
    cmd?: string;
    name: string;
    pid: number;
    ppid: number;
    startTime?: string;
};

export function getWindowsPowerShellPath(): string {
    const systemRoot = process.env.SystemRoot;
    const invalidRootCharacters = systemRoot && (/[<>:"|?*]/.test(systemRoot.slice(2))
        || Array.from(systemRoot.slice(2)).some(character => character.charCodeAt(0) <= 0x1f));
    if (!systemRoot || invalidRootCharacters || !/^[a-z]:[\\/]/i.test(systemRoot)) {
        throw new Error("SystemRoot must be a drive-qualified absolute Windows path");
    }

    const powershellPath = path.win32.join(path.win32.normalize(systemRoot), ...WINDOWS_POWERSHELL_RELATIVE_PATH);
    if (!path.win32.isAbsolute(powershellPath)) {
        throw new Error("Could not resolve an absolute Windows PowerShell path");
    }
    return powershellPath;
}

export function buildWindowsPowerShellArgs(script: string): string[] {
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");
    return ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript];
}

export function getWindowsProcessesByName(name: string): Promise<WindowsProcessDetails[]> {
    if (!name) {
        return Promise.resolve([]);
    }

    const encodedProcessName = Buffer.from(name, "utf8").toString("base64");
    const script = `$TargetProcessName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedProcessName}'))\n${WINDOWS_PROCESS_LIST_SCRIPT}`;

    return new Promise((resolve, reject) => {
        execFile(getWindowsPowerShellPath(), buildWindowsPowerShellArgs(script), {
            encoding: "utf8",
            maxBuffer: 1_000_000,
            shell: false,
            timeout: WINDOWS_PROCESS_LIST_TIMEOUT_MS,
            windowsHide: true,
        }, (error, stdout) => {
            if (error) {
                reject(error);
                return;
            }

            try {
                const output = stdout.trim();
                const parsed = output ? JSON.parse(output) : [];
                const processes = Array.isArray(parsed) ? parsed : [parsed];
                resolve(processes.flatMap(processDetails => {
                    const pid = Number(processDetails?.pid);
                    const ppid = Number(processDetails?.ppid);
                    if (!Number.isSafeInteger(pid) || pid <= 0 || !Number.isSafeInteger(ppid) || typeof processDetails?.name !== "string") {
                        return [];
                    }
                    return [{
                        pid,
                        ppid,
                        name: processDetails.name,
                        cmd: typeof processDetails.cmd === "string" ? processDetails.cmd : undefined,
                        startTime: typeof processDetails.startTime === "string" ? processDetails.startTime : undefined,
                    }];
                }));
            } catch (error) {
                reject(error);
            }
        });
    });
}
