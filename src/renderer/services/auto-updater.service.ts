import { lastValueFrom, Observable } from 'rxjs';
import { map } from "rxjs/operators";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { I18nService } from "./i18n.service";
import { Changelog } from "../../shared/models/bs-launch/launch-changelog.interface"
import { ModalService } from "../services/modale.service";
import { ChangelogModal } from "../components/modal/modal-types/changelog/changelog-modal.component";
import { useService } from "renderer/hooks/use-service.hook";
import { OsDiagnosticService } from './os-diagnostic.service';

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

    public getHaveBeenUpdated(){
        return this.ipcService.sendV2<boolean>("have-been-updated");
    }

  public async getChangelogs(): Promise<Changelog | null> {
    const path = `https://raw.githubusercontent.com/Zagrios/bs-manager/master/assets/jsons/changelogs/${this.i18nService.currentLanguage.split("-")[0]}.json`
    return new Promise((resolve) => {
      fetch(path)
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => resolve(data))
        .catch(error => {
          resolve(null);
        });
    });
  }

  public async openChangelog(force?: boolean): Promise<void> {
    const isUpdated = await lastValueFrom(this.getHaveBeenUpdated());
    if (!isUpdated && !force) {console.log("coucou"); return ;}

    const data = await this.getChangelogs();
    if (!data) {console.log("coucou2"); return ;}

    return this.modalService.openModal(ChangelogModal, data).then(() =>{});
  }
}
