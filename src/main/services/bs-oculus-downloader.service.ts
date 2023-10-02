import { BSVersion } from "../../shared/bs-version.interface";
import { WindowManagerService } from "./window-manager.service";
import { minToMs } from "../../shared/helpers/time.helpers";
import log from "electron-log";
import { CustomError } from "../../shared/models/exceptions/custom-error.class";
import { OculusDownloader } from "../models/oculus-downloader.class";

export class BsOculusDownloaderService {

    private static instance: BsOculusDownloaderService;

    public static getInstance(): BsOculusDownloaderService {
        if (!BsOculusDownloaderService.instance) {
            BsOculusDownloaderService.instance = new BsOculusDownloaderService();
        }

        return BsOculusDownloaderService.instance;
    }

    private readonly windows: WindowManagerService;

    private readonly oculusDownloader: OculusDownloader;

    private constructor() {
        this.windows = WindowManagerService.getInstance();

        this.oculusDownloader = new OculusDownloader();
    }

    private isUserTokenValid(token: string): boolean{

        // Code take from "https://github.com/ComputerElite/QuestAppVersionSwitcher" (TokenTools.cs)

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

    public async getUserToken(): Promise<string>{
        const redirectUrl = "https://developer.oculus.com/manage/";
        const loginUrl = `https://auth.oculus.com/login/?redirect_uri=${encodeURIComponent(redirectUrl)}`;
        const window = await this.windows.openWindow(loginUrl, { frame: true });

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
            if(!window.isDestroyed() && window.isClosable()){
                window.close();
            }
            clearTimeout(timout);
        });

        return promise;
    }

    public async downloadVersion(version: BSVersion){
        const token = await this.getUserToken();
        console.log(token);
        const s = this.oculusDownloader.downloadApp({ accessToken: token, binaryId: "5074476459318759", destination: "" }).subscribe({
            next: a => console.log(a),
            error: a => console.error(a),
            complete: () => console.log("complete")
        });
    }

}