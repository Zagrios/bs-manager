import { map } from "rxjs/operators";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { ModalService } from "renderer/services/modale.service";
import { ChangelogModal } from "renderer/components/modal/modal-types/chabgelog-modal/changelog-modal.component";
import { ConfigurationService } from "./configuration.service";
import { Observable, lastValueFrom } from "rxjs";


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

    private downloadProgress$: Observable<number>;

    private modal: ModalService;

    private configurationService: ConfigurationService;

    private cacheChangelog: Changelog;

    public static getInstance(): AutoUpdaterService {
        if (!AutoUpdaterService.instance) {
            AutoUpdaterService.instance = new AutoUpdaterService();
        }
        return AutoUpdaterService.instance;
    }

    private constructor() {
        this.progressService = ProgressBarService.getInstance();
        this.ipcService = IpcService.getInstance();
        this.modal = ModalService.getInstance();
        this.configurationService = ConfigurationService.getInstance();

        this.downloadProgress$ = this.ipcService.watch<number>("update-download-progress").pipe(map(res => (res.success ? res.data : 0)));
    }

    public isUpdateAvailable(): Promise<boolean> {
        return lastValueFrom(this.ipcService.sendV2<boolean>("check-update")).catch(() => false);
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

    public getLastAppVersion(): string {
        return this.configurationService.get("last-app-version");
    }

    public setLastAppVersion(value : string){
        this.configurationService.set("last-app-version", value);
    }

    private async getChangelog(): Promise<Changelog> {
        if (this.cacheChangelog) {
            return this.cacheChangelog;
        }

        const path = `https://raw.githubusercontent.com/Zagrios/bs-manager/master/assets/jsons/changelogs.json`
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to fetch changelogs (${response.status})`);
        }

        const data = await response.json();
        if (!data) {
            throw new Error(`Failed to parse changelogs`);
        }

        this.cacheChangelog = data;
        return data;
    }

    private async getChangelogVersion(version:string): Promise<ChangelogVersion> {
        const changelogs = await this.getChangelog();

        const changelogVersion = changelogs[version];
        if (!changelogVersion) {
            throw new Error(`No changelog found for this version (${version})`);
        }

        return changelogVersion;
    }

    public getAppVersion() : Observable<string> {
        return this.ipcService.sendV2<string>("current-version");
    }

    public async showChangelog(version:string): Promise<void>{
            const changelog = await this.getChangelogVersion(version);

            this.modal.openModal(ChangelogModal, changelog);
    }
}
