import { autoUpdater } from "electron-updater";
import log from "electron-log";
import { UtilsService } from "./utils.service";
import { gt } from "semver";
import { Observable } from "rxjs";
import { ConfigurationService } from "./configuration.service";

export class AutoUpdaterService {
    private static instance: AutoUpdaterService;

    private readonly utilsService: UtilsService;

    private readonly ConfigurationService: ConfigurationService

    private readonly HAVE_BEEN_UPDATED_KEY : string;

    public static getInstance(): AutoUpdaterService {
        if (!AutoUpdaterService.instance) {
            AutoUpdaterService.instance = new AutoUpdaterService();
        }
        return AutoUpdaterService.instance;
    }

    constructor() {
        autoUpdater.logger = log;
        autoUpdater.autoDownload = false;

        this.utilsService = UtilsService.getInstance();
        this.ConfigurationService = ConfigurationService.getInstance();
        this.HAVE_BEEN_UPDATED_KEY = "haveBeenUpdated";
    }

    public isUpdateAvailable(): Promise<boolean> {
        return new Promise(resolve => {
            autoUpdater
                .checkForUpdates()
                .then(info => {
                    const needUpdate = (() => {
                        if (!info?.updateInfo) {
                            return false;
                        }
                        this.setHaveBeenUpdated(true);
                        return gt(info.updateInfo.version, autoUpdater.currentVersion.version);
                    })();
                    resolve(needUpdate);
                })
                .catch(() => resolve(false));
        });
    }

    public downloadUpdate(): Promise<boolean> {
        autoUpdater.removeAllListeners("download-progress");
        autoUpdater.addListener("download-progress", info => {
            this.utilsService.ipcSend("update-download-progress", { success: true, data: info.percent });
        });

        return autoUpdater.downloadUpdate().then(res => !!res && !!res.length);
    }

    public quitAndInstall() {
        autoUpdater.quitAndInstall();
    }


    public getHaveBeenUpdated(): Observable<boolean> {
        const haveBeenUpdated = this.ConfigurationService.get(this.HAVE_BEEN_UPDATED_KEY);
        return new Observable<boolean>((observer) => {
            observer.next(haveBeenUpdated as boolean);
            observer.complete();
        });
    }

    public setHaveBeenUpdated(value: boolean): void {
        this.ConfigurationService.set(this.HAVE_BEEN_UPDATED_KEY, value);
    }


}
