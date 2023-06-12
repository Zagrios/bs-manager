import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { I18nService } from "./i18n.service";


export class AutoUpdaterService{


    private static instance: AutoUpdaterService;
    private i18nService: I18nService;
    private progressService: ProgressBarService;
    private ipcService: IpcService;

    private downloadProgress$: Observable<number>;

    public static getInstance(): AutoUpdaterService{
        if(!AutoUpdaterService.instance){ AutoUpdaterService.instance = new AutoUpdaterService(); }
        return AutoUpdaterService.instance;
    }

    private constructor(){
        this.progressService = ProgressBarService.getInstance();
        this.ipcService = IpcService.getInstance();
        this.i18nService = I18nService.getInstance();
        this.downloadProgress$ = this.ipcService.watch<number>("update-download-progress").pipe(map(res => res.success ? res.data : 0));
    }

    public isUpdateAvailable(): Promise<boolean>{
        return this.ipcService.send<boolean>("check-update").then(res => {
            if(!res.success){ return false; }
            return res.data;
        })
    }

    public downloadUpdate(): Promise<boolean>{
        const promise = this.ipcService.send<boolean>("download-update").then(res => {
            return res.success;
        });

        this.progressService.show(this.downloadProgress$, true);
        return promise;
    }

    public quitAndInstall(){
        this.ipcService.sendLazy("install-update");
    }
    public getHaveBeenUpdated(): Observable<boolean>{
        return this.ipcService.sendV2<boolean>("have-been-updated");
    }

    public async getChangelogsData(): Promise<ChangelogData | null> {
      try {
            this.changelog = fetch(`https://github.com/Zagrios/bs-manager/tree/master/assets/jsons/changelogs/${this.i18nService.currentLanguage.split("-")[0]}.json`);
            return this.changelog;
        } catch (error) {
            return null;
        }
    }
}
