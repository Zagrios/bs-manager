import { autoUpdater, CancellationToken, ProgressInfo } from "electron-updater";
import log from "electron-log";
import { gt } from "semver";
import { Progression } from "main/helpers/fs.helpers";
import { Observable } from "rxjs";

export class AutoUpdaterService {
    private static instance: AutoUpdaterService;

    public static getInstance(): AutoUpdaterService {
        if (!AutoUpdaterService.instance) {
            AutoUpdaterService.instance = new AutoUpdaterService();
        }
        return AutoUpdaterService.instance;
    }

    constructor() {
        autoUpdater.logger = log;
        autoUpdater.autoDownload = false;
    }

    public async isUpdateAvailable(): Promise<boolean> {
        return autoUpdater.checkForUpdates()
            .then(info => {
                return !!info?.updateInfo && gt(
                info.updateInfo.version, autoUpdater.currentVersion.version
            )})
            .catch(error => {
                log.error("Could not get update", error);
                return false;
            });
    }

    public downloadUpdate(): Observable<Progression> {
        return new Observable<Progression>(observer => {

            observer.next({ current: 0, total: 0 });

            const progressListener = (progress: ProgressInfo) => {
                observer.next({ current: progress.transferred, total: progress.total });
            };

            const downloadedListener = () => {
                observer.next({ current: 100, total: 100 });
            };

            autoUpdater.addListener("download-progress", progressListener);
            autoUpdater.addListener("update-downloaded", downloadedListener);

            const cancelToken = new CancellationToken();

            autoUpdater.downloadUpdate(cancelToken)
                .catch(err => observer.error(err))
                .finally(() => observer.complete());

            return () => {
                cancelToken.cancel();
                autoUpdater.removeListener("download-progress", progressListener);
                autoUpdater.removeListener("update-downloaded", downloadedListener);
            }
        });
    }

    public quitAndInstall() {
        log.info("Quit and install");
        return autoUpdater.quitAndInstall();
    }
}
