export interface BSLaunchEvent{
    type: BSLaunchEventType;
    data?: unknown;
}

export interface BSLaunchErrorEvent{
    type: BSLaunchErrorType;
    data?: unknown;
}

export enum BSLaunchErrorType{
    BS_NOT_FOUND = "EXE_NOT_FINDED",
    BS_ALREADY_RUNNING = "BS_ALREADY_RUNNING",
    OCULUS_NOT_RUNNING = "OCULUS_NOT_RUNNING",
    BS_EXIT_ERROR = "EXIT",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export enum BSLaunchEventType{
    STEAM_LAUNCHING = "STEAM_LAUNCHING",
    BS_LAUNCHING = "BS_LAUNCHING",
}