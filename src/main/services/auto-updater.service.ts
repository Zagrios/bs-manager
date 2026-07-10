import { autoUpdater, CancellationToken, ProgressInfo, UpdateInfo } from "electron-updater";
import log from "electron-log";
import { prerelease } from "semver";
import { Progression } from "main/helpers/fs.helpers";
import { Observable } from "rxjs";
import { safeGt } from "shared/helpers/semver.helpers";
import { StaticConfigurationService } from "./static-configuration.service";

export class AutoUpdaterService {
    private static instance: AutoUpdaterService;
    private readonly staticConfig = StaticConfigurationService.getInstance();

    public static getInstance(): AutoUpdaterService {
        if (!AutoUpdaterService.instance) {
            AutoUpdaterService.instance = new AutoUpdaterService();
        }
        return AutoUpdaterService.instance;
    }

    constructor() {
        autoUpdater.logger = log;
        autoUpdater.autoDownload = false;
        this.configureUpdateChannel();
        this.staticConfig.$watch("pre-release-updates").subscribe(() => this.configureUpdateChannel());
    }

    private configureUpdateChannel(): void {
        const allowPrerelease = this.staticConfig.get("pre-release-updates", false);

        autoUpdater.allowPrerelease = allowPrerelease;
        // A stable release can be numerically older than the beta currently installed.
        // Keeping this enabled lets users explicitly return to the latest stable release.
        autoUpdater.allowDowngrade = true;
    }

    private isStableDowngradeAvailable(version: string): boolean {
        const prereleaseUpdatesEnabled = this.staticConfig.get("pre-release-updates", false);
        const currentVersionIsPrerelease = !!prerelease(autoUpdater.currentVersion.version);
        const updateVersionIsPrerelease = !!prerelease(version);

        return !prereleaseUpdatesEnabled && currentVersionIsPrerelease && !updateVersionIsPrerelease;
    }

    private isUpdateAvailableForCurrentChannel(updateInfo: UpdateInfo | null | undefined): boolean {
        if (!updateInfo) {
            return false;
        }

        return safeGt(updateInfo.version, autoUpdater.currentVersion.version)
            || this.isStableDowngradeAvailable(updateInfo.version);
    }

    public async isUpdateAvailable(): Promise<boolean> {
        return autoUpdater.checkForUpdates()
            .then(info => {
                return this.isUpdateAvailableForCurrentChannel(info?.updateInfo)
            })
            .catch(error => {
                log.error("Could not get update", error);
                return false;
            });
    }

    public async getAvailableUpdate(): Promise<UpdateInfo | null> {
        return autoUpdater.checkForUpdates().then(info => {
                if (this.isUpdateAvailableForCurrentChannel(info?.updateInfo)) {
                    return info.updateInfo;
                }
                return null;
            }).catch((error: Error): UpdateInfo | null => {
                log.error("Could not get update", error);
                return null;
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
