import { BSVersion } from "main/services/bs-version-lib.service";

export interface LauchOption {
    version: BSVersion,
    oculus: boolean,
    desktop: boolean,
    debug: boolean
}

export type BsLaunchResult = "LAUNCHED" | "STEAM_NOT_RUNNING" | "EXE_NOT_FINDED" | "BS_ALREADY_RUNNING";