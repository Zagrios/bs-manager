import { lastValueFrom, Observable } from 'rxjs';
import { map } from "rxjs/operators";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { I18nService } from "./i18n.service";
import { Changelog } from "../../shared/models/bs-launch/launch-changelog.interface"
import { ModalService } from "../services/modale.service";
import { ChangelogModal } from "../components/modal/modal-types/changelog/changelog-modal.component";

export class AutoUpdaterService{

    private static instance: AutoUpdaterService;

    private progressService: ProgressBarService;

    private ipcService: IpcService;

    private downloadProgress$: Observable<number>;

    private i18nService: I18nService;

    private modalService: ModalService

    public static getInstance(): AutoUpdaterService{
        if(!AutoUpdaterService.instance){ AutoUpdaterService.instance = new AutoUpdaterService(); }
        return AutoUpdaterService.instance;
    }

    private constructor(){

      this.progressService = ProgressBarService.getInstance();
      this.ipcService = IpcService.getInstance();
      this.i18nService = I18nService.getInstance();
      this.modalService = ModalService.getInstance();

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

    public getHaveBeenUpdated() : Observable<boolean>{
        return this.ipcService.sendV2<boolean>("have-been-updated");
    }

  public async getChangelogs(): Promise<Changelog | null> {
    try {
      const path = `https://raw.githubusercontent.com/Zagrios/bs-manager/master/assets/jsons/changelogs/${this.i18nService.currentLanguage.split("-")[0]}.json`;

      const response = await fetch(path);
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (!data?.body) {
        return;
      }
      return data;

    } catch (error) {
      return;
    }
  }

  public async openChangelog(): Promise<void> {
    const data = await this.getChangelogs();
    if (!data) {return ;}

    return this.modalService.openModal(ChangelogModal, data).then(() =>{});
  }
}
