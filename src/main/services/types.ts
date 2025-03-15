import { BSVersion } from "shared/bs-version.interface";

// NOTE: Partial interfaces for now

export interface BSLocalVersionServiceV2 {
    getVersionPath(version: BSVersion): Promise<string>;
}

export interface InstallationLocationServiceV2 {
    sharedContentPath(): string;
}
