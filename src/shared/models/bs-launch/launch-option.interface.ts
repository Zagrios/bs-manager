import { BSVersion } from "shared/bs-version.interface";

export interface LauchOption {
    version: BSVersion,
    oculus: boolean,
    desktop: boolean,
    debug: boolean,
    additionalArgs?: string[]
}