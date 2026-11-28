export interface BSLaunchEventData{
    type: BSLaunchEventType;
    data?: unknown;
}

export interface BSLaunchErrorData{
    type: BSLaunchError;
    data?: unknown;
}

export enum BSLaunchError{
    BS_NOT_FOUND = "EXE_NOT_FOUND",
    BS_ALREADY_RUNNING = "BS_ALREADY_RUNNING",
    OCULUS_NOT_RUNNING = "OCULUS_NOT_RUNNING",
    OCULUS_NOT_INSTALLED = "OCULUS_NOT_INSTALLED",
    BS_EXIT_ERROR = "EXIT",
    OCULUS_LIB_NOT_FOUND = "OCULUS_LIB_NOT_FOUND",
    PROTON_NOT_SET = "PROTON_NOT_SET",
    PROTON_NOT_FOUND = "PROTON_NOT_FOUND",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    ORIGINAL_OCULUS_NOT_INSTALLED = "ORIGINAL_OCULUS_NOT_INSTALLED",
    // The native ARM64 build couldn't be removed to fall back to the x64 build
    BS_ARM64_RESTORE_FAILED = "BS_ARM64_RESTORE_FAILED"
}

export enum BSLaunchEvent{
    STEAM_LAUNCHING = "STEAM_LAUNCHING",
    STEAM_LAUNCHED = "STEAM_LAUNCHED",
    BS_LAUNCHING = "BS_LAUNCHING",
    // Installing, repairing or updating the native ARM64 build before the launch
    BS_ARM64_PREPARING = "BS_ARM64_PREPARING",
}

export enum BSLaunchWarning{
    UNABLE_TO_LAUNCH_STEAM = "UNABLE_TO_LAUNCH_STEAM",
    // The native ARM64 build can't run right now (e.g. Proton was updated); the x64 build starts
    BS_ARM64_FALLBACK = "BS_ARM64_FALLBACK",
}

export type BSLaunchEventType = BSLaunchEvent | BSLaunchWarning;
