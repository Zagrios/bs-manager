import path from "node:path";

const WINDOWS_POWERSHELL_RELATIVE_PATH = [
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
];

export function getWindowsPowerShellPath(): string {
    const systemRoot = process.env.SystemRoot;
    const invalidRootCharacters = systemRoot && (/[<>:"|?*]/.test(systemRoot.slice(2))
        || Array.from(systemRoot.slice(2)).some(character => character.codePointAt(0) <= 0x1f));
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
