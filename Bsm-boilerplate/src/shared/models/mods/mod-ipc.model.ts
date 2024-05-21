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
