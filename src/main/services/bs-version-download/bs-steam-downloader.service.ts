import { BS_APP_ID, BS_DEPOT } from "../../constants";
import path from "path";
import { BSVersion } from "shared/bs-version.interface";
import log from "electron-log";
import { InstallationLocationService } from "../installation-location.service";
import { BSLocalVersionService } from "../bs-local-version.service";
import { ensureDir, readJson } from "fs-extra";
import { ensurePathNotAlreadyExist } from "../../helpers/fs.helpers";
import { Observable, concatMap, map } from "rxjs";
import { DepotDownloaderErrorEvent, DepotDownloaderEvent, DepotDownloaderEventType, DepotDownloaderInfoEvent } from "../../../shared/models/bs-version-download/depot-downloader.model";
import { BsDownloader } from "../../models/bs-downloader.class";
import { loadSteamDownloadSession, saveSteamDownloadSession } from "./steam-download-session";
import { app } from "electron";
import { BsStore } from "../../../shared/models/bs-store.enum";
import { CustomError } from "shared/models/exceptions/custom-error.class";

export class BsSteamDownloaderService {
    private static instance: BsSteamDownloaderService;

    private readonly installLocationService: InstallationLocationService;
    private readonly localVersionService: BSLocalVersionService;

    private depotDownloader: BsDownloader;
    private requestId = 0;

    private constructor() {
        this.installLocationService = InstallationLocationService.getInstance();
        this.localVersionService = BSLocalVersionService.getInstance();

        app.on("before-quit", () => {
            this.stopDownload();
        });
    }

    public static getInstance() {
        if (!BsSteamDownloaderService.instance) {
            BsSteamDownloaderService.instance = new BsSteamDownloaderService();
        }
        return BsSteamDownloaderService.instance;
    }

    private async buildDepotDownloaderInstance(downloadInfos: DownloadSteamInfo, qr?: boolean): Promise<{depotDownloader: BsDownloader, version: BSVersion}> {

        const versionPath = await this.localVersionService.getVersionPath(downloadInfos.bsVersion);
        const pending = await readJson(path.join(versionPath, ".bs-download", "pending.json")).catch(() => undefined);
        const resumable = pending?.depot === BS_DEPOT && pending?.manifest === String(downloadInfos.bsVersion.BSManifest);
        const dest = downloadInfos.isVerification || resumable ? versionPath : await ensurePathNotAlreadyExist(versionPath);
        const downloadVersion: BSVersion = {
            ...downloadInfos.bsVersion,
            ...(path.basename(dest) !== downloadInfos.bsVersion.BSVersion && { name: path.basename(dest) }),
            metadata: { store: BsStore.STEAM, id: "" }
        };

        await ensureDir(this.installLocationService.versionsDirectory());
        const saved = !qr && !downloadInfos.password ? await loadSteamDownloadSession(downloadInfos.username) : undefined;
        const depotDownloader = new BsDownloader({
            app: Number(BS_APP_ID),
            depot: Number(BS_DEPOT),
            directory: dest,
            manifest: String(downloadInfos.bsVersion.BSManifest),
            username: saved?.username || downloadInfos.username || "",
            password: downloadInfos.password || "",
            refreshToken: saved?.refreshToken,
            qr: !!qr,
        }, downloadVersion, log, downloadInfos.stay ? saveSteamDownloadSession : undefined);

        return { depotDownloader, version: downloadVersion }
    }

    private buildDepotDownloaderObservable(downloadInfos: DownloadSteamInfo, qr?: boolean): Observable<DepotDownloaderEvent> {
        return new Observable(sub => {
            const requestId = ++this.requestId;
            const stopped = this.depotDownloader?.stop();
            const depotDownloaderBuildPromise = Promise.resolve(stopped).then(() => this.buildDepotDownloaderInstance(downloadInfos, qr));

            depotDownloaderBuildPromise.then(({ depotDownloader, version }) => {
                if (sub.closed) { return; }
                if (requestId !== this.requestId) { sub.complete(); return; }

                this.depotDownloader = depotDownloader;

                depotDownloader.$events().pipe(
                    map(event => {
                        if(event.type === DepotDownloaderEventType.Error){
                            throw new CustomError("bs-downloader failed", event?.subType ?? DepotDownloaderErrorEvent.Unknown, event)
                        }
                        return event;
                    }),
                    concatMap(async event => {
                        if (event.type === DepotDownloaderEventType.Info && event.subType === DepotDownloaderInfoEvent.Finished) {
                            await this.localVersionService.initVersionMetadata(version, { store: BsStore.STEAM });
                        }
                        return event;
                    })
                ).subscribe(sub);

            }).catch(err => {
                if (err instanceof CustomError
                    && Object.values(DepotDownloaderErrorEvent).includes(
                        err.code as DepotDownloaderErrorEvent
                    )
                ) {
                    return sub.error(err);
                }

                return sub.error({
                    type: DepotDownloaderEventType.Error,
                    subType: DepotDownloaderErrorEvent.Unknown,
                    data: err
                } as DepotDownloaderEvent)
            });

            return () => {
                depotDownloaderBuildPromise.then(({ depotDownloader }) => depotDownloader.stop()).catch(() => {});
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
        this.requestId++;
        this.depotDownloader?.stop();
    }
}

export interface DownloadInfo {
    bsVersion: BSVersion;
    isVerification?: boolean;
    stay?: boolean;
}

export interface DownloadSteamInfo extends DownloadInfo {
    username?: string;
    password?: string;
}
