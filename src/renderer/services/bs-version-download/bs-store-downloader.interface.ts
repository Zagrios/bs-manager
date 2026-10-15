import { BSVersion } from "shared/bs-version.interface";

export interface StoreDownloadOptions {
    isVerification: boolean;
    onStart: (version: BSVersion) => void;
}

export interface DownloaderServiceInterface {
    download(version: BSVersion, options: StoreDownloadOptions): Promise<BSVersion | undefined>;
    stopDownload(): Promise<void>;
}
