export function isCloseOnLaunchSupported(platform: string): boolean {
    return platform === "win32" || platform === "linux";
}
