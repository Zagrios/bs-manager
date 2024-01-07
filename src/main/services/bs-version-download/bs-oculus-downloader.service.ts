import { BSVersion } from "../../../shared/bs-version.interface";
import { WindowManagerService } from "../window-manager.service";
import { minToMs, msToS } from "../../../shared/helpers/time.helpers";
import log from "electron-log";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { OculusDownloader } from "../../models/oculus-downloader.class";
import { Cookie, session } from "electron";
import { Progression, ensurePathNotAlreadyExist } from "../../helpers/fs.helpers";
import { BSLocalVersionService } from "../bs-local-version.service";
import { Observable, finalize, from, map, of, switchMap } from "rxjs";
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
    
    private readonly windows: WindowManagerService;
    private readonly versions: BSLocalVersionService;

    private constructor() {
        this.windows = WindowManagerService.getInstance();
        this.versions = BSLocalVersionService.getInstance();

        this.oculusDownloader = new OculusDownloader();
    }

    private isUserTokenValid(token: string): boolean{
        return isOculusTokenValid(token, log.info);
    }

    private isCookieValid(cookie: Cookie): boolean {

        if(!cookie){
            return false;
        }

        return cookie.expirationDate > msToS(Date.now());
    }

    public async getAuthToken(): Promise<string | undefined> {
        const cookie = await session.defaultSession.cookies.get({ name: "oc_www_at" }).then(a => a?.at(0));

        if(this.isCookieValid(cookie) && this.isUserTokenValid(cookie.value)){
            return cookie.value;
        }

        return undefined;
    }

    private async getUserTokenFromMetaAuth(keepToken: boolean): Promise<string>{

        const redirectUrl = "https://developer.oculus.com/manage/";
        const loginUrl = `https://auth.oculus.com/login/?redirect_uri=${encodeURIComponent(redirectUrl)}`;
        const window = await this.windows.openWindow(loginUrl, { frame: true, width: 650, height: 800 });

        let timout: NodeJS.Timeout;

        const promise = new Promise<string>((resolve, reject) => {
            timout = setTimeout(() => {
                reject(new CustomError("Trying to get Oculus user token timed out", "META_LOGIN_TIMED_OUT"));
                window.close();
            }, minToMs(5));
            
            window.webContents.on("did-navigate", async (_, url) => {
                if(!url.startsWith(redirectUrl)){ return; }

                const token = (await window.webContents.session.cookies.get({ name: "oc_www_at" })).at(0)?.value;
                
                if(!this.isUserTokenValid(token)){
                    return;
                }
                
                resolve(token);
            });

            window.on("closed", () => {
                reject(new CustomError("Oculus login window closed by user", "META_LOGIN_WINDOW_CLOSED_BY_USER"));
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

        return promise;
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

        const tokenObs$ = downloadInfo.token ? of(downloadInfo.token) : from(this.getUserTokenFromMetaAuth(downloadInfo.stay));

        return tokenObs$.pipe(
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

    public autoDownloadVersion(downloadInfo: DownloadInfo): Observable<Progression<BSVersion>>{

        let downloadVersion: BSVersion

        const tokenObs$ = downloadInfo.token ? of(downloadInfo.token) : from(this.getAuthToken());

        return tokenObs$.pipe(
            map(token => {
                if(!token){
                    throw new CustomError("No Meta auth token was found in cookies for auto download", "NO_META_AUTH_TOKEN");
                }
                return token;
            }), 
            switchMap(token => {
                if(!downloadInfo.isVerification){
                    return this.createDownloadVersion(downloadInfo.bsVersion).then(({version, dest}) => ({token, version, dest}));
                }
                return this.versions.getVersionPath(downloadInfo.bsVersion).then(path => ({token, version: downloadInfo.bsVersion, dest: path}));
            }),
            switchMap(({token, version, dest}) => {
                downloadVersion = version;
                return this.oculusDownloader.downloadApp({ accessToken: token, binaryId: version.OculusBinaryId, destination: dest }).pipe(
                    map(progress => ({...progress, data: version})),
                );
            }),
            finalize(() => downloadVersion && this.versions.initVersionMetadata(downloadVersion, { store: BsStore.OCULUS })),
            finalize(() => this.oculusDownloader.stopDownload()),
        );
    }

    public clearAuthToken(): Promise<void>{
        return session.defaultSession.clearStorageData({ storages: ["cookies"], origin: ".oculus.com" })
    }

}

export interface OculusDownloadInfo {
    version: BSVersion;
    stay?: boolean;
}