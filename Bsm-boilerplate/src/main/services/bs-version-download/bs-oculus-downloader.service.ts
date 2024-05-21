import { BSVersion } from "../../../shared/bs-version.interface";
import log from "electron-log";
import { OculusDownloader } from "../../models/oculus-downloader.class";
import { Progression, ensurePathNotAlreadyExist } from "../../helpers/fs.helpers";
import { BSLocalVersionService } from "../bs-local-version.service";
import { Observable, finalize, map, of, switchMap } from "rxjs";
import path from "path";
import { DownloadInfo } from "./bs-steam-downloader.service";
import { BsStore } from "../../../shared/models/bs-store.enum";
import { isOculusTokenValid } from "../../../shared/helpers/oculus.helpers";

export class BsOculusDownloaderService {

    private static instance: BsOculusDownloaderService;

    public static getInstance(): BsOculusDownloaderService {
        if (!BsOculusDownloaderService.instance) {
            BsOculusDownloaderService.instance = new BsOculusDownloaderService();
        }

        return BsOculusDownloaderService.instance;
    }

    private readonly oculusDownloader: OculusDownloader;
    private readonly versions: BSLocalVersionService;

    private constructor() {
        this.versions = BSLocalVersionService.getInstance();

        this.oculusDownloader = new OculusDownloader();
    }

    private async createDownloadVersion(version: BSVersion): Promise<{version: BSVersion, dest: string}>{
        const dest = await ensurePathNotAlreadyExist(await this.versions.getVersionPath(version));
        return {
            version: {
                ...version,
                ...(path.basename(dest) !== version.BSVersion && { name: path.basename(dest) }),
                metadata: { store: BsStore.OCULUS, id: "" }
            },
            dest
        };
    }

    public stopDownload(){
        this.oculusDownloader.stopDownload();
    }

    public downloadVersion(downloadInfo: DownloadInfo): Observable<Progression<BSVersion>>{

        let downloadVersion: BSVersion

        return of(downloadInfo.token).pipe(
            switchMap(token => {
                isOculusTokenValid(token, log.info); // Log token validity
                if(!downloadInfo.isVerification){
                    return this.createDownloadVersion(downloadInfo.bsVersion).then(({version, dest}) => ({token, version, dest}))
                }
                return this.versions.getVersionPath(downloadInfo.bsVersion).then(path => ({token, version: downloadInfo.bsVersion, dest: path}));
            }),
            switchMap(({token, version, dest}) => {
                downloadVersion = version;
                return this.oculusDownloader.downloadApp({ accessToken: token, binaryId: version.OculusBinaryId, destination: dest }).pipe(map(
                    progress => ({...progress, data: version})
                ));
            }),
            finalize(() => downloadVersion && this.versions.initVersionMetadata(downloadVersion, { store: BsStore.OCULUS })),
            finalize(() => this.oculusDownloader.stopDownload())
        );
    }

}

export interface OculusDownloadInfo {
    version: BSVersion;
    stay?: boolean;
}
