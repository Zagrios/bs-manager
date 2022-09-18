import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { UtilsService } from './utils.service';
export class AutoUpdaterService {

    private static instance: AutoUpdaterService;

    private readonly utilsService: UtilsService;

    public static getInstance(): AutoUpdaterService{
        if(!AutoUpdaterService.instance){ AutoUpdaterService.instance = new AutoUpdaterService(); }
        return AutoUpdaterService.instance;
    }

    constructor(){
        autoUpdater.logger = log;
        autoUpdater.autoDownload = false;

        this.utilsService = UtilsService.getInstance();
    }

    public isUpdateAvailable(): Promise<boolean>{
        return new Promise(resolve => {
            autoUpdater.checkForUpdates().then(info => {
                const needUpdate = (() => {
                    if(!info || !info.updateInfo){ return false; }
                    if(autoUpdater.currentVersion.version === info.updateInfo.version){ return false; }
                    return true;
                })();
                resolve(needUpdate)}
            ).catch(() => resolve(false));
        });
    }

    public downloadUpdate(): Promise<boolean>{
        
        autoUpdater.removeAllListeners("download-progress");
        autoUpdater.addListener("download-progress", info => {
            this.utilsService.ipcSend("update-download-progress", {success: true, data: info.percent});
        });
        // const promise = new Promise<boolean>((resolve, reject) => {
        //     autoUpdater.addListener("update-downloaded", () => resolve(true));
        //     autoUpdater.addListener("error", () => reject(false))
        // });
        
        return autoUpdater.downloadUpdate().then(res => !!res && !!res.length);
    }

    public quitAndInstall(){
        autoUpdater.quitAndInstall();
    }



}