import { DownloadEvent } from 'main/services/bs-installer.service';
import { BehaviorSubject, distinctUntilChanged, filter, debounceTime } from 'rxjs';
import { IpcResponse } from 'shared/models/ipc-models.model';
import { BSVersion } from '../../main/services/bs-version-manager.service'
import { AuthUserService } from './auth-user.service';
import { BSVersionManagerService } from './bs-version-manager.service';
import { IpcService } from './ipc.service';
import { ModalExitCode, ModalService, ModalType } from './modale.service';
import { NotificationService } from './notification.service';
import { ProgressBarService } from './progress-bar.service';

export class BsDownloaderService{

    private static instance: BsDownloaderService;

    private readonly modalService: ModalService;
    private readonly ipcService: IpcService;
    private readonly bsVersionManager: BSVersionManagerService;
    private readonly authService: AuthUserService;
    private readonly progressBarService: ProgressBarService;
    private readonly notificationService: NotificationService;

    public readonly currentBsVersionDownload$: BehaviorSubject<BSVersion> = new BehaviorSubject(null);

    public readonly downloadProgress$: BehaviorSubject<number> = new BehaviorSubject(0);
    public readonly downloadWarning$: BehaviorSubject<string> = new BehaviorSubject(null);
    public readonly downloadError$: BehaviorSubject<string> = new BehaviorSubject(null);

    public readonly selectedBsVersion$: BehaviorSubject<BSVersion> = new BehaviorSubject(null);

    public static getInstance(): BsDownloaderService{
        if(!BsDownloaderService.instance){ BsDownloaderService.instance = new BsDownloaderService(); }
        return BsDownloaderService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();
        this.modalService = ModalService.getInsance();
        this.bsVersionManager = BSVersionManagerService.getInstance();
        this.authService = AuthUserService.getInstance();
        this.progressBarService = ProgressBarService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.asignListerners();
    }

   private asignListerners(): void{
      this.ipcService.watch<number>("bs-download.[Progress]").pipe(distinctUntilChanged()).subscribe(response => this.downloadProgress$.next(response.data));

      this.ipcService.watch<string>("bs-download.[SteamID]").pipe(filter(r => r.success && !!r.data)).subscribe(response => this.authService.setSteamID(response.data));

      this.ipcService.watch<string>("bs-download.[Warning]").pipe(filter(v => !!v && !!v.data),  distinctUntilChanged(), debounceTime(1000)).subscribe(warning => {
         this.notificationService.notifyWarning({title: "notifications.types.warning", desc: `notifications.bs-download.warnings.msg.${warning.data}`});
      });

      this.ipcService.watch<string>("bs-download.[Error]").pipe(filter(v => !!v && !!v.data),  distinctUntilChanged(), debounceTime(1000)).subscribe(err => {
         this.notificationService.notifyError({title: "notifications.types.error", desc: `notifications.bs-download.errors.msg.${err.data}`});
      });

      this.ipcService.watch<void>("bs-download.[2FA]").subscribe(async response => {
         if(!response.success){ return; }
         const res = await this.modalService.openModal(ModalType.GUARD_CODE);
         if(res.exitCode !== ModalExitCode.COMPLETED){ return; }
         this.ipcService.sendLazy('bs-download.[2FA]', {args: res.data});
      });

      this.currentBsVersionDownload$.subscribe(version => {
         if(version){ this.bsVersionManager.setInstalledVersions([...this.bsVersionManager.installedVersions$.value, version]); }
         else{ this.bsVersionManager.askInstalledVersions(); }
      });
    }

    private resetDownload(): void{
        this.currentBsVersionDownload$.next(null);
        this.downloadProgress$.next(0);
        this.selectedBsVersion$.next(null);
    }

   public async download(bsVersion: BSVersion, isVerification?: boolean): Promise<IpcResponse<DownloadEvent>>{
      if(this.progressBarService.visible$.value){ 
         this.notificationService.notifyError({title: "notifications.bs-download.errors.titles.already-downloading"});
         return {success: false};
      }

      this.progressBarService.show(this.downloadProgress$);

      let promise;
      if(!this.authService.sessionExist()){
         const res = await this.modalService.openModal(ModalType.STEAM_LOGIN);
         if(res.exitCode !== ModalExitCode.COMPLETED){ return {success: false}; }
         this.authService.setSteamSession(res.data.username, res.data.stay);
         promise = this.ipcService.send<DownloadEvent>('bs-download.start', {args: {bsVersion: bsVersion, username: res.data.username, password: res.data.password, stay: res.data.stay}});
      }
      else{
         promise = this.ipcService.send<DownloadEvent>('bs-download.start', {args: {bsVersion: bsVersion, username: this.authService.getSteamUsername()}});
      }

      this.currentBsVersionDownload$.next(bsVersion);

      let res = await promise;
        
      if(res.data.type === "[Password]"){
         this.authService.deleteSteamSession();
         res = await this.download(bsVersion);
      }
      
      this.progressBarService.hide(true);
      this.resetDownload();
      res.success && this.notificationService.notifySuccess({title: `notifications.bs-download.success.titles.${isVerification ? "verification-finished" : "download-success"}`, duration: 3000});
      return res;
   }

   public get isDownloading(): boolean{
      return !!this.currentBsVersionDownload$.value;
   }

   public async getInstallationFolder(): Promise<string>{
      const res = await this.ipcService.send<string>("bs-download.installation-folder");
      return res.success ? res.data : "";
   }

   public setInstallationFolder(path: string): Promise<IpcResponse<string>>{
      return this.ipcService.send<string>("bs-download.set-installation-folder", {args: path});
   }

}
