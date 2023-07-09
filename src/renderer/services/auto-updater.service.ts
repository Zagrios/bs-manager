import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";

export class AutoUpdaterService {
    private static instance: AutoUpdaterService;

    private progressService: ProgressBarService;
    private ipcService: IpcService;

    private downloadProgress$: Observable<number>;

    public static getInstance(): AutoUpdaterService {
        if (!AutoUpdaterService.instance) {
            AutoUpdaterService.instance = new AutoUpdaterService();
        }
        return AutoUpdaterService.instance;
    }

    private constructor() {
        this.progressService = ProgressBarService.getInstance();
        this.ipcService = IpcService.getInstance();

        this.downloadProgress$ = this.ipcService.watch<number>("update-download-progress").pipe(map(res => (res.success ? res.data : 0)));
    }

    public isUpdateAvailable(): Promise<boolean> {
        return this.ipcService.send<boolean>("check-update").then(res => {
            if (!res.success) {
                return false;
            }
            return res.data;
        });
    }

    public downloadUpdate(): Promise<boolean> {
        const promise = this.ipcService.send<boolean>("download-update").then(res => {
            return res.success;
        });

        this.progressService.show(this.downloadProgress$, true);
        return promise;
    }

    public quitAndInstall() {
        this.ipcService.sendLazy("install-update");
    }
}
