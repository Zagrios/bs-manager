import { Observable, lastValueFrom } from "rxjs";
import { map } from "rxjs/operators";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { I18nService } from "./i18n.service";
import { Changelog, ChangelogVersion } from "../../shared/models/bs-launch/launch-changelog.interface"
import { ModalService } from "./modale.service";
import { ChangelogModal } from "../components/modal/modal-types/changelog/changelog-modal.component";

export class AutoUpdaterService {
    private static instance: AutoUpdaterService;

    private progressService: ProgressBarService;

    private ipcService: IpcService;

    private downloadProgress$: Observable<number>;

    private i18nService: I18nService;

    private modalService: ModalService;

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
        this.modalService = ModalService.getInstance();

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

    public getHaveBeenUpdated() : Observable<boolean>{
        return this.ipcService.sendV2<boolean>("have-been-updated");
    }

  public async getChangelogs(): Promise<Changelog> {
    try {
      const path = `https://raw.githubusercontent.com/Zagrios/bs-manager/feature/add-changelog-modal/178/assets/jsons/changelogs/${this.i18nService.currentLanguage.split("-")[0]}.json`;

      const response = await fetch(path);
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (!data) {
        return;
      }
      return data;

    } catch (error) {
      this.ipcService.sendLazy("log-error", { args: error });
    }
  }

  public async getChangelogByVersion(version: string): Promise<ChangelogVersion> {
      const changelogs = await this.getChangelogs();
      if (!changelogs) {return;}

      const changelogVersion = changelogs[version];

      return changelogVersion;
  }

  public async showChangelog(version?: string) : Promise<boolean> {
    const currentVersion = await this.getAppVersion();
    const changelog = await this.getChangelogByVersion(version ?? currentVersion);

    if (!changelog) {return false;}

    return this.modalService.openModal(ChangelogModal, changelog).then(()=> true ).catch(()=> false );
  }

  public async getAppVersion() {
    const currentVersion = await lastValueFrom(this.ipcService.sendV2<string>("current-version"));
    return currentVersion;
  }
}
