import { randomUUID } from "crypto";
import { app } from "electron";
import log from "electron-log";
import { noop } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsStore } from "../../../shared/models/bs-store.enum";
import { BS_APP_ID, BS_DEPOT } from "../../constants";
import { BsDownloader } from "../../models/bs-downloader.class";
import { BSLocalVersionService } from "../bs-local-version.service";
import { InstallationLocationService } from "../installation-location.service";
import { resolveSteamDownloadDestination } from "./steam-download-destination";
import { steamSessionStorage } from "./steam-download-session";
import { SteamDownloader } from "./steam-downloader";

export class BsSteamDownloaderService {
    private static instance: SteamDownloader;

    public static getInstance(): SteamDownloader {
        if (!BsSteamDownloaderService.instance) {
            BsSteamDownloaderService.instance = BsSteamDownloaderService.create();
        }
        return BsSteamDownloaderService.instance;
    }

    private static create(): SteamDownloader {
        const installLocation = InstallationLocationService.getInstance();
        const localVersions = BSLocalVersionService.getInstance();

        const downloader = new SteamDownloader({
            createProcess: (options, version, onSession) => new BsDownloader({ app: Number(BS_APP_ID), depot: Number(BS_DEPOT), ...options }, version, log, onSession),
            resolveDestination: request => resolveSteamDownloadDestination(request, {
                depot: BS_DEPOT,
                versionPath: version => localVersions.getVersionPath(version),
                versionsDirectory: () => installLocation.versionsDirectory(),
            }),
            commitVersion: version => localVersions.initVersionMetadata(version, { store: BsStore.STEAM }).then(noop),
            storage: steamSessionStorage,
            createId: () => randomUUID(),
            logger: log,
        });

        app.on("before-quit", () => {
            downloader.stop();
        });

        return downloader;
    }
}

export interface DownloadInfo {
    bsVersion: BSVersion;
    isVerification?: boolean;
    stay?: boolean;
}
