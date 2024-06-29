export interface BSLaunchEventData{
    type: BSLaunchEventType;
    data?: unknown;
}

export interface BSLaunchErrorData{
    type: BSLaunchError;
    data?: unknown;
}

export enum BSLaunchError{
    BS_NOT_FOUND = "EXE_NOT_FINDED",
    BS_ALREADY_RUNNING = "BS_ALREADY_RUNNING",
    OCULUS_NOT_RUNNING = "OCULUS_NOT_RUNNING",
    BS_EXIT_ERROR = "EXIT",
    OCULUS_LIB_NOT_FOUND = "OCULUS_LIB_NOT_FOUND",
    PROTON_NOT_SET = "PROTON_NOT_SET",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export enum BSLaunchEvent{
    STEAM_LAUNCHING = "STEAM_LAUNCHING",
    STEAM_LAUNCHED = "STEAM_LAUNCHED",
    BS_LAUNCHING = "BS_LAUNCHING",
}

export enum BSLaunchWarning{
    UNABLE_TO_LAUNCH_STEAM = "UNABLE_TO_LAUNCH_STEAM",
}

export type BSLaunchEventType = BSLaunchEvent | BSLaunchWarning;
