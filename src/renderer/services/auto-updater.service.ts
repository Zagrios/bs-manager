import { BehaviorSubject, Observable, lastValueFrom } from "rxjs";
import { map } from "rxjs/operators";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { I18nService } from "./i18n.service";
import { ModalService } from "renderer/services/modale.service";
import { ChangelogModal } from "renderer/components/modal/modal-types/chabgelog-modal/changelog-modal.component";
import { ConfigurationService } from "./configuration.service";

export interface Changelog {
  [version: string]: ChangelogVersion;
}
export interface ChangelogVersion {
  htmlBody: string;
  title: string;
  timestampPublished: number;
  version: string;
}
export class AutoUpdaterService {
    private static instance: AutoUpdaterService;

    private progressService: ProgressBarService;
    private ipcService: IpcService;

    private downloadProgress$: Observable<number>;

    private i18nService: I18nService;

    private modal: ModalService;

    private configurationService: ConfigurationService;

    public static getInstance(): AutoUpdaterService {
        if (!AutoUpdaterService.instance) {
            AutoUpdaterService.instance = new AutoUpdaterService();
        }
        return AutoUpdaterService.instance;
    }

    private constructor() {
        this.progressService = ProgressBarService.getInstance();
        this.ipcService = IpcService.getInstance();
        this.i18nService = I18nService.getInstance();
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

    public getHaveBeenUpdated(): boolean {
        return this.configurationService.get("have-been-updated");
    }

    public setHaveBeenUpdated(value: boolean){
        this.configurationService.set("have-been-updated", value);
    }


    private async getChangelog(): Promise<Changelog> {
        const path = `https://raw.githubusercontent.com/Zagrios/bs-manager/feature/add-changelog-modal/178/assets/jsons/changelogs/${this.i18nService.currentLanguage.split("-")[0]}.json`
        const response = await fetch(path);
        if (!response.ok) {
            return undefined;
        }

        const data = await response.json();
        if (!data) {
            return undefined;
        }
        return data;
    }

    private async getChangelogVersion(version:string): Promise<ChangelogVersion> {
        const changelogs = await this.getChangelog();
        if (!changelogs) {
            throw new Error(`No changelogs found`);
        }

        const changelogVersion = changelogs[version];
        if (!changelogVersion) {
            throw new Error(`No changelog found for this version (${version})`);
        }


        return changelogVersion;
    }

    public getAppVersion() : Observable<string> {
        return this.ipcService.sendV2<string>("current-version");
    }

    public async showChangelog(): Promise<void>{
        try{
          if(this.getHaveBeenUpdated()){
            const currentVersion = await lastValueFrom(this.getAppVersion());
            const changelog = await this.getChangelogVersion(currentVersion);

            this.modal.openModal(ChangelogModal, changelog);
          }
        }
        catch(error){
            this.ipcService.sendLazy("log-error", {args: error});
        }
    }
}
