import { BS_APP_ID, BS_DEPOT } from "../../constants";
import path from "path";
import { BSVersion } from "shared/bs-version.interface";
import { UtilsService } from "../utils.service";
import log from "electron-log";
import { InstallationLocationService } from "../installation-location.service";
import { BSLocalVersionService } from "../bs-local-version.service";
import { ensureDir } from "fs-extra";
import { ensurePathNotAlreadyExist } from "../../helpers/fs.helpers";
import { Observable, finalize, map } from "rxjs";
import { DepotDownloaderArgsOptions, DepotDownloaderErrorEvent, DepotDownloaderEvent, DepotDownloaderEventType, DepotDownloaderInfoEvent } from "../../../shared/models/bs-version-download/depot-downloader.model";
import { DepotDownloader } from "../../models/depot-downloader.class";
import { app } from "electron";
import { BsStore } from "../../../shared/models/bs-store.enum";

export class BsSteamDownloaderService {
    private static instance: BsSteamDownloaderService;

    private readonly utils: UtilsService;
    private readonly installLocationService: InstallationLocationService;
    private readonly localVersionService: BSLocalVersionService;

    private depotDownloader: DepotDownloader;

    private constructor() {
        this.utils = UtilsService.getInstance();
        this.installLocationService = InstallationLocationService.getInstance();
        this.localVersionService = BSLocalVersionService.getInstance();

        app.on("before-quit", () => {
            this.depotDownloader?.stop();
        });
    }

    public static getInstance() {
        if (!BsSteamDownloaderService.instance) {
            BsSteamDownloaderService.instance = new BsSteamDownloaderService();
        }
        return BsSteamDownloaderService.instance;
    }

    private getDepotDownloaderExePath(): string {
        return path.join(this.utils.getAssetsScriptsPath(), process.platform === 'linux' ? "DepotDownloader" : "DepotDownloader.exe");
    }

    private async buildDepotDownloaderInstance(downloadInfos: DownloadSteamInfo, qr?: boolean): Promise<{depotDownloader: DepotDownloader, depotDownloaderOptions: DepotDownloaderArgsOptions, version: BSVersion}> {

        const versionPath = await this.localVersionService.getVersionPath(downloadInfos.bsVersion);
        const dest = downloadInfos.isVerification ? versionPath : await ensurePathNotAlreadyExist(versionPath);
        const downloadVersion: BSVersion = {
            ...downloadInfos.bsVersion,
            ...(path.basename(dest) !== downloadInfos.bsVersion.BSVersion && { name: path.basename(dest) }),
            metadata: { store: BsStore.STEAM, id: "" }
        };

        const depotDownloaderOptions: DepotDownloaderArgsOptions = {
            app: BS_APP_ID,
            depot: BS_DEPOT,
            dir: this.localVersionService.getVersionFolder(downloadVersion),
            manifest: downloadInfos.bsVersion.BSManifest,
            username: downloadInfos.username,
            password: downloadInfos.password,
            "remember-password": downloadInfos.stay,
            validate: downloadInfos.isVerification,
            qr
        }

        await ensureDir(this.installLocationService.versionsDirectory());

        const exePath = this.getDepotDownloaderExePath();
        const args = DepotDownloader.buildArgs(depotDownloaderOptions);

        const depotDownloader = new DepotDownloader({
            command: exePath,
            args,
            options: { cwd: this.installLocationService.versionsDirectory() },
            echoStartData: downloadVersion
        }, log);

        return { depotDownloader, depotDownloaderOptions, version: downloadVersion }
    }

    private buildDepotDownloaderObservable(downloadInfos: DownloadSteamInfo, qr?: boolean): Observable<DepotDownloaderEvent> {
        return new Observable(sub => {

            const depotDownloaderBuildPromise = this.buildDepotDownloaderInstance(downloadInfos, qr);

            depotDownloaderBuildPromise.then(({ depotDownloader, version }) => {

                if(this.depotDownloader?.running){
                    this.depotDownloader.stop();
                }

                this.depotDownloader = depotDownloader;

                depotDownloader.$events().pipe(
                    map(event => {
                        if(event.type === DepotDownloaderEventType.Error){
                            throw event;
                        }
                        return event;
                    }),
                    finalize(() => this.localVersionService.initVersionMetadata(version, { store: BsStore.STEAM }))
                ).subscribe(sub);

            }).catch(err => sub.error({
                type: DepotDownloaderEventType.Error,
                subType: DepotDownloaderErrorEvent.Unknown,
                data: err
            } as DepotDownloaderEvent));

            return () => {
                depotDownloaderBuildPromise.then(({ depotDownloader }) => depotDownloader.stop());
            }
        });
    }

    public downloadBsVersion(downloadInfos: DownloadSteamInfo): Observable<DepotDownloaderEvent> {
        return this.buildDepotDownloaderObservable(downloadInfos);
    }

    public autoDownloadBsVersion(downloadInfos: DownloadSteamInfo): Observable<DepotDownloaderEvent> {
        return this.buildDepotDownloaderObservable({...downloadInfos, password: null, stay: true}).pipe(map(event => {
            if(event.type === DepotDownloaderEventType.Info &&  event.subType === DepotDownloaderInfoEvent.Password){
                throw new Error("Ask for password while auto download");
            }
            return event;
        }));
    }

    public downloadBsVersionWithQRCode(downloadInfos: DownloadSteamInfo): Observable<DepotDownloaderEvent> {
        return this.buildDepotDownloaderObservable(downloadInfos, true);
    }

    public sendInput(input: string): boolean {
        return this.depotDownloader?.sendInput(input);
    }

    public stopDownload(): void {
        this.depotDownloader?.stop();
    }
}

export interface DownloadInfo {
    bsVersion: BSVersion;
    isVerification?: boolean;
    stay?: boolean;
    token?: string;
}

export interface DownloadSteamInfo extends DownloadInfo {
    username?: string;
    password?: string;
}

export interface DownloadEvent {
    type: DownloadEventType;
    data?: unknown;
}

export type DownloadEventType = "[Password]" | "[Guard]" | "[2FA]" | "[Progress]" | "[Validated]" | "[Finished]" | "[AlreadyDownloading]" | "[Error]" | "[Warning]" | "[SteamID]" | "[Exit]" | "[NoInternet]";
