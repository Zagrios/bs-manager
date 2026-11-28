import { BSVersion } from "shared/bs-version.interface";

export const LaunchMods = {
    OCULUS: "oculus",
    FPFC: "fpfc",
    DEBUG: "debug",
    SKIP_STEAM: "skip_steam",
    EDITOR: "editor",
    PROTON_LOGS: "proton_logs",
    PARALLEL_VIEWS: "parallel_views",
    // Eye-tracked foveated rendering on the Steam Frame (ARM64 Linux)
    FOVEATED_RENDERING: "foveated_rendering",
} as const;

export type LaunchMod = typeof LaunchMods[keyof typeof LaunchMods];

export interface LaunchOption {
    version: BSVersion,
    launchMods?: LaunchMod[],
    command?: string,
    admin?: boolean
}
