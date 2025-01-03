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
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { minToMs } from "shared/helpers/time.helpers";
import { session } from "electron";
import { WindowManagerService } from "../window-manager.service";
import { addFilterStringLog } from "../../main";
import { MetaAuthErrorCodes } from "shared/models/bs-version-download/oculus-download.model";

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
    private readonly windows: WindowManagerService;

    private constructor() {
        this.versions = BSLocalVersionService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.oculusDownloader = new OculusDownloader();
    }

    public async getUserTokenFromMetaAuth(keepToken: boolean): Promise<string>{

        const loginUrl = "https://secure.oculus.com";
        const redirectUrl = `${loginUrl}/my/profile`;
        const window = await this.windows.openWindow(loginUrl, { frame: true, width: 650, height: 800 });

        let timout: NodeJS.Timeout;

        return new Promise<string>((resolve, reject) => {
            timout = setTimeout(() => {
                reject(new CustomError("Trying to get Oculus user token timed out", MetaAuthErrorCodes.META_LOGIN_TIMED_OUT));
                window.close();
            }, minToMs(10));

            const tryExtractToken = async () => {
                log.info("Meta auth window navigated to", new URL(window.webContents.getURL()).origin + new URL(window.webContents.getURL()).pathname); // Dot not log full url for privacy reasons
                if(!window.webContents.getURL()?.startsWith(redirectUrl)){ return; }

                const token = (await window.webContents.session.cookies.get({ name: "oc_ac_at" })).at(0)?.value;

                if(!isOculusTokenValid(token, log.info)){
                    return;
                }

                addFilterStringLog(token);
                resolve(token);
            }

            window.webContents.on("did-stop-loading", tryExtractToken);
            window.webContents.on("did-navigate", tryExtractToken);
            window.webContents.on("did-navigate-in-page", tryExtractToken);

            window.on("closed", () => {
                reject(new CustomError("Oculus login window closed by user", MetaAuthErrorCodes.META_LOGIN_WINDOW_CLOSED_BY_USER));
            });
        }).finally(() => {

            clearTimeout(timout);

            if(!keepToken){
                this.clearAuthToken();
            }

            if(!window.isDestroyed() && window.isClosable()){
                window.close();
            }
        });
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

    public downloadVersion(downloadInfo: OculusDownloadInfo): Observable<Progression<BSVersion>>{

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

    public clearAuthToken(): Promise<void>{
        return session.defaultSession.clearStorageData({ storages: ["cookies"], origin: ".oculus.com" })
    }

    public metaSessionExists(): Promise<boolean>{
        return session.defaultSession.cookies.get({ domain: ".oculus.com" }).then(cookies => cookies.length > 0);
    }

}

export interface OculusDownloadInfo extends DownloadInfo {
    token: string;
}
