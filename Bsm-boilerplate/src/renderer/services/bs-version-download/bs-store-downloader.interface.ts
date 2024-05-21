import { BSVersion } from "shared/bs-version.interface";

export interface DownloaderServiceInterface {
    downloadBsVersion(version: BSVersion): Promise<BSVersion>;
    verifyBsVersion(version: BSVersion): Promise<BSVersion>;
}