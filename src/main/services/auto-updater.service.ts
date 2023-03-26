import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { UtilsService } from './utils.service';
import { gt } from 'semver';
import { ConfigurationService } from './configuration.service';
import { Observable } from 'rxjs';

export class AutoUpdaterService {

    private static instance: AutoUpdaterService;

    private readonly utilsService: UtilsService;

    private readonly configService : ConfigurationService;
    private readonly HAVE_BEEN_UPDATED_KEY = "haveBeenUpdated";


    public static getInstance(): AutoUpdaterService{
        if(!AutoUpdaterService.instance){ AutoUpdaterService.instance = new AutoUpdaterService(); }
        return AutoUpdaterService.instance;
    }

    constructor(){
        autoUpdater.logger = log;
        autoUpdater.autoDownload = false;
        this.configService = ConfigurationService.getInstance();
        this.utilsService = UtilsService.getInstance();
    }

    public isUpdateAvailable(): Promise<boolean>{
        return new Promise(resolve => {
            autoUpdater.checkForUpdates().then(info => {
                const needUpdate = (() => {
                    if(!info || !info.updateInfo){ return false; }
                    return gt(info.updateInfo.version, autoUpdater.currentVersion.version);
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
        
        return autoUpdater.downloadUpdate().then(res => !!res && !!res.length);
    }

    public quitAndInstall(){
        this.configService.set(this.HAVE_BEEN_UPDATED_KEY, true);
        autoUpdater.quitAndInstall();
    }
    public getHaveBeenUpdated(): boolean {
        return this.configService.get(this.HAVE_BEEN_UPDATED_KEY);
      }
}