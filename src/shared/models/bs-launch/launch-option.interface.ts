import { BSVersion } from "shared/bs-version.interface";

export const LaunchMods = {
    OCULUS: "oculus",
    FPFC: "fpfc",
    DEBUG: "debug",
    SKIP_STEAM: "skip_steam",
    EDITOR: "editor",
    PROTON_LOGS: "proton_logs",
    BSM_HOOK: "bsm_hook",
} as const;

export type LaunchMod = typeof LaunchMods[keyof typeof LaunchMods];

export interface LaunchOption {
    version: BSVersion,
    launchMods?: LaunchMod[],
    command?: string,
    admin?: boolean
}
