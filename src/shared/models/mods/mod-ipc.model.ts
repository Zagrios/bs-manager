export interface ModInstallProgression {
    name: string;
    progression: number;
}

export interface InstallModsResult {
    nbModsToInstall: number;
    nbInstalledMods: number;
}

export interface UninstallModsResult {
    nbModsToUninstall: number;
    nbUninstalledMods: number;
}

export enum ModsGridStatus {
    OK = "",
    NO_WINEPREFIX = "pages.version-viewer.mods.status.no-wineprefix",
    UNKNOWN = "misc.unknown"
}

