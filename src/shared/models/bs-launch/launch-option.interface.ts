import { BSVersion } from "shared/bs-version.interface";

export interface LaunchOption {
    version: BSVersion,
    oculus?: boolean,
    desktop?: boolean,
    debug?: boolean,
    additionalArgs?: string[],
    skipAlreadyRunning?: boolean
}
