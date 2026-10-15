import { BSVersion } from "shared/bs-version.interface";
import { DepotDownloaderWarningEvent } from "./depot-downloader.model";

export interface SteamDownloadRequest {
    bsVersion: BSVersion;
    isVerification?: boolean;
}

export type SteamDownloadEvent =
    | { type: "Started"; downloadId: string; version: BSVersion; isVerification: boolean }
    | { type: "NeedsLogin" }
    | { type: "QrCode"; url: string }
    | { type: "NeedsGuardCode" }
    | { type: "NeedsMobileApproval" }
    | { type: "LoggedIn"; steamId: string }
    | { type: "Progress"; progress: number }
    | { type: "Warning"; code: DepotDownloaderWarningEvent }
    | { type: "Done"; version: BSVersion };

export type SteamDownloadAnswer =
    | { type: "Password"; username: string; password: string; stay: boolean }
    | { type: "GuardCode"; code: string };

export interface SteamDownloadResponse {
    downloadId: string;
    answer: SteamDownloadAnswer;
}
