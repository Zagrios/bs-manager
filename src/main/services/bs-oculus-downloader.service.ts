import { BSVersion } from "../../shared/bs-version.interface";
import { WindowManagerService } from "./window-manager.service";
import { minToMs, msToS } from "../../shared/helpers/time.helpers";
import log from "electron-log";
import { CustomError } from "../../shared/models/exceptions/custom-error.class";
import { OculusDownloader } from "../models/oculus-downloader.class";
import { Cookie, session } from "electron";
import { Progression, pathExist } from "../helpers/fs.helpers";
import { BSLocalVersionService } from "./bs-local-version.service";
import { Observable, Subscription } from "rxjs";

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

        // Code taken from "https://github.com/ComputerElite/QuestAppVersionSwitcher" (TokenTools.cs)

        log.info("Checking if Oculus user token is valid");

        if(!token){
            log.info("Oculus user token is empty");
            return false;
        }
        if(token.includes("%")){
            log.info("Token contains %. Token most likely comes from an uri and won't work");
            return false;
        }
        if(!token.startsWith("OC")){
            log.info("Token does not start with OC.");
            return false;
        }
        if(token.includes("|")){
            log.info("Token contains | which usually indicates an application token which is not valid for user tokens");
            return false;
        }
        if(token.match(/OC[0-9]{15}/)){
            log.info("Token matches /OC[0-9}{15}/ which usually indicates a changed oculus store token");
            return false;
        }

        return true;

    }

    private isCookieValid(cookie: Cookie): boolean {

        if(!cookie){
            return false;
        }

        return cookie.expirationDate > msToS(Date.now());
    }

    public async getTokenFromCookie(): Promise<string | undefined> {
        const cookie = await session.defaultSession.cookies.get({ name: "oc_www_at" }).then(a => a.at(0));

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
                reject(new CustomError("Trying to get Oculus user token timed out", "OCULUS_LOGIN_TIMED_OUT"));
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
                reject(new CustomError("Oculus login window closed by user", "OCULUS_LOGIN_WINDOW_CLOSED_BY_USER"));
            });
        }).finally(() => {

            clearTimeout(timout);
            
            if(!keepToken){
                this.clearTokenCookie();
            }

            if(window.isClosable() && !window.isDestroyed()){
                window.close();
            }
        });

        return promise;
    }

    /**
     * DUPLICATION FROM BS-INSTALLER.SERVICE (TODO : need to be refactored)
     * @param path 
     * @returns 
     */
    private async getPathNotAleardyExist(path: string): Promise<string> {
        let destPath = path;
        let folderExist = await pathExist(destPath);
        let i = 0;

        while (folderExist) {
            i++;
            destPath = `${path} (${i})`;
            folderExist = await pathExist(destPath);
        }

        return destPath;
    }

    public downloadVersion(downloadInfo: OculusDownloadInfo){

        return new Observable<Progression>(obs => {

            let sub: Subscription;

            (async () => {
                const token = await this.getUserTokenFromMetaAuth(downloadInfo.stay);
                const dest = await this.getPathNotAleardyExist(await this.versions.getVersionPath(downloadInfo.version));

                sub = this.oculusDownloader.downloadApp({ accessToken: token, binaryId: downloadInfo.version.OculusBinaryId, destination: dest }).subscribe(obs);
            })().catch(err => obs.error(err));

            return () => {
                sub?.unsubscribe();
                this.oculusDownloader.stopDownload();
            }
        })
        
    }

    public autoDownloadVersion(version: BSVersion): Observable<Progression>{

        return new Observable<Progression>(obs => {

            let sub: Subscription;

            (async () => {
                const token = await this.getTokenFromCookie();

                if(!token){
                    throw new CustomError("No token has been found while try to auto download Beat Saber from Oculus", "OCULUS_TOKEN_NEEDED");
                }

                const dest = await this.getPathNotAleardyExist(await this.versions.getVersionPath(version));

                sub = this.oculusDownloader.downloadApp({ accessToken: token, binaryId: version.OculusBinaryId, destination: dest }).subscribe(obs);
            })().catch(err => obs.error(err));

            return () => {
                sub?.unsubscribe();
                this.oculusDownloader.stopDownload();
            }
        });
    }

    public clearTokenCookie(): Promise<void>{
        return session.defaultSession.clearStorageData({ storages: ["cookies"], origin: ".oculus.com" })
    }

}

export interface OculusDownloadInfo {
    version: BSVersion;
    stay?: boolean;
}