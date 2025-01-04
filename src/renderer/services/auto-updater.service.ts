import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { Observable, lastValueFrom } from "rxjs";
import { Progression } from "main/helpers/fs.helpers";


export interface Changelog {
    [version: string]: ChangelogVersion;
}
export interface ChangelogVersion {
    htmlBody: string;
    title: string;
    timestamp : number;
    version: string;
}
export class AutoUpdaterService {
    private static instance: AutoUpdaterService;

    private progressService: ProgressBarService;
    private ipcService: IpcService;

    public static getInstance(): AutoUpdaterService {
        if (!AutoUpdaterService.instance) {
            AutoUpdaterService.instance = new AutoUpdaterService();
        }
        return AutoUpdaterService.instance;
    }

    private constructor() {
        this.progressService = ProgressBarService.getInstance();
        this.ipcService = IpcService.getInstance();
    }

    public async isUpdateAvailable(): Promise<boolean> {
        return lastValueFrom(this.ipcService.sendV2("check-update")).catch(() => false);
    }

    public downloadUpdate(): Observable<Progression> {
        return new Observable<Progression>(obs => {
            const download$ = this.ipcService.sendV2("download-update");
            this.progressService.show(download$);

            const sub = download$.subscribe(obs);

            return () => {
                sub.unsubscribe();
                this.progressService.hide();
            }
        });
    }

    public quitAndInstall(): Promise<void> {
        return lastValueFrom(this.ipcService.sendV2("install-update"));
    }

    public getAppVersion() : Observable<string> {
        return this.ipcService.sendV2("current-version");
    }

}
