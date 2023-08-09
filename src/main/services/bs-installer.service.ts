import { BS_APP_ID, BS_DEPOT } from "../constants";
import path from "path";
import { BSVersion } from "shared/bs-version.interface";
import { UtilsService } from "./utils.service";
import { spawnSync } from "child_process";
import log from "electron-log";
import { InstallationLocationService } from "./installation-location.service";
import { BSLocalVersionService } from "./bs-local-version.service";
import { WindowManagerService } from "./window-manager.service";
import { copy, ensureDir } from "fs-extra";
import { pathExist } from "../helpers/fs.helpers";
import { Observable, map } from "rxjs";
import { DepotDownloaderArgsOptions, DepotDownloaderErrorEvent, DepotDownloaderEvent, DepotDownloaderEventType, DepotDownloaderInfoEvent } from "../../shared/models/depot-downloader.model";
import { DepotDownloader } from "../models/depot-downloader.class";

export class BSInstallerService {
    private static instance: BSInstallerService;

    private readonly utils: UtilsService;
    private readonly installLocationService: InstallationLocationService;
    private readonly localVersionService: BSLocalVersionService;
    private readonly windows: WindowManagerService;

    private depotDownloader: DepotDownloader;

    private constructor() {
        this.utils = UtilsService.getInstance();
        this.installLocationService = InstallationLocationService.getInstance();
        this.localVersionService = BSLocalVersionService.getInstance();
        this.windows = WindowManagerService.getInstance();

        this.windows.getWindow("index.html")?.on("close", () => {
            this.depotDownloader?.stop();
        });
    }

    public static getInstance() {
        if (!BSInstallerService.instance) {
            BSInstallerService.instance = new BSInstallerService();
        }
        return BSInstallerService.instance;
    }

    private getDepotDownloaderExePath(): string {
        return path.join(this.utils.getAssetsScriptsPath(), "depot-downloader", `DepotDownloader.${process.platform === 'linux' ? 'dll' : 'exe'}`);
    }

    public async isDotNet6Installed(): Promise<boolean> {
        try {
           const proc = process.platform === 'linux'
                ? spawnSync('dotnet', [this.getDepotDownloaderExePath()])
                : spawnSync(this.getDepotDownloaderExePath());
            if (proc.stderr?.toString()) {
                log.error("no dotnet", proc.stderr.toString());
                return false;
            }
            return true;
        } catch (e) {
            log.error("Error while checking .NET 6", e);
            return false;
        }
    }

    private async buildDepotDownloaderInstance(downloadInfos: DownloadInfo, qr?: boolean): Promise<DepotDownloader> {

        const versionPath = await this.localVersionService.getVersionPath(downloadInfos.bsVersion);
        const dest = downloadInfos.isVerification ? versionPath : await this.getPathNotAleardyExist(versionPath);
        const downloadVersion: BSVersion = { ...downloadInfos.bsVersion, ...(path.basename(dest) !== downloadInfos.bsVersion.BSVersion && { name: path.basename(dest) }) };

        const depotDownloaderOptions: DepotDownloaderArgsOptions = {
            app: BS_APP_ID,
            depot: BS_DEPOT,
            dir: this.localVersionService.getVersionFolder(downloadVersion),
            manifest: downloadInfos.bsVersion.BSManifest,
            username: downloadInfos.username,
            password: downloadInfos.password,
            "remember-password": downloadInfos.stay,
            validate: downloadInfos.isVerification,
            qr
        }

        await ensureDir(this.installLocationService.versionsDirectory);

        const isLinux = process.platform === 'linux';
        const exePath = this.getDepotDownloaderExePath();
        const args = DepotDownloader.buildArgs(depotDownloaderOptions);

        return new DepotDownloader({
            command: isLinux ? 'dotnet' : exePath,
            args: isLinux ? [exePath, ...args] : args,
            options: { cwd: this.installLocationService.versionsDirectory },
            echoStartData: downloadVersion
        }, log);
    }

    private buildDepotDownloaderObservable(downloadInfos: DownloadInfo, qr?: boolean): Observable<DepotDownloaderEvent> {
        return new Observable(sub => {

            const depotDownloaderBuildPromise = this.buildDepotDownloaderInstance(downloadInfos, qr);

            depotDownloaderBuildPromise.then(depotDownloader => {

                if(this.depotDownloader?.running){
                    this.depotDownloader.stop();
                }

                this.depotDownloader = depotDownloader;

                depotDownloader.$events().pipe(map(event => {
                    if(event.type === DepotDownloaderEventType.Error){
                        throw event;
                    }
                    return event;
                })).subscribe(sub);

            }).catch(err => sub.error({
                type: DepotDownloaderEventType.Error,
                subType: DepotDownloaderErrorEvent.Unknown,
                data: err
            } as DepotDownloaderEvent));

            return () => {
                depotDownloaderBuildPromise.then(depotDownloader => depotDownloader.stop());
            }
        });
    }

    public downloadBsVersion(downloadInfos: DownloadInfo): Observable<DepotDownloaderEvent> {
        return this.buildDepotDownloaderObservable(downloadInfos);
    }

    public autoDownloadBsVersion(downloadInfos: DownloadInfo): Observable<DepotDownloaderEvent> {
        return this.buildDepotDownloaderObservable({...downloadInfos, password: null, stay: true}).pipe(map(event => {
            if(event.type === DepotDownloaderEventType.Info &&  event.subType === DepotDownloaderInfoEvent.Password){
                throw new Error("Ask for password while auto download");
            }
            return event;
        }));
    }

    public downloadBsVersionWithQRCode(downloadInfos: DownloadInfo): Observable<DepotDownloaderEvent> {
        return this.buildDepotDownloaderObservable(downloadInfos, true);
    }

    public sendInput(input: string): boolean {
        return this.depotDownloader?.sendInput(input);
    }

    public stopDownload(): void {
        this.depotDownloader?.stop();
    }

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

    public async importVersion(path: string): Promise<BSVersion> {
        const version = await this.localVersionService.getVersionOfBSFolder(path);

        if (!version) {
            throw new Error("NOT_BS_FOLDER");
        }

        const destPath = await this.getPathNotAleardyExist(await this.localVersionService.getVersionPath(version));

        await copy(path, destPath, { dereference: true });

        return version;
    }
}

export interface DownloadInfo {
    bsVersion: BSVersion;
    username?: string;
    password?: string;
    stay?: boolean;
    isVerification?: boolean;
}

export interface DownloadEvent {
    type: DownloadEventType;
    data?: unknown;
}

export type DownloadEventType = "[Password]" | "[Guard]" | "[2FA]" | "[Progress]" | "[Validated]" | "[Finished]" | "[AlreadyDownloading]" | "[Error]" | "[Warning]" | "[SteamID]" | "[Exit]" | "[NoInternet]";
