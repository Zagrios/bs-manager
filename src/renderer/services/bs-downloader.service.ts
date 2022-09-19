import { DownloadEvent } from 'main/services/bs-installer.service';
import { BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, filter, throttleTime } from 'rxjs/operators';
import { IpcResponse } from 'shared/models/ipc';
import { BSVersion } from 'shared/bs-version.interface';
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

    private _isVerification: boolean = false;

    public readonly currentBsVersionDownload$: BehaviorSubject<BSVersion> = new BehaviorSubject(null);
    public readonly downloadProgress$: BehaviorSubject<number> = new BehaviorSubject(0);
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

      this.ipcService.watch<string>("bs-download.[Warning]").pipe(filter(v => !!v && !!v.data),  distinctUntilChanged(), throttleTime(1000)).subscribe(warning => {
         this.notificationService.notifyWarning({title: "notifications.types.warning", desc: `notifications.bs-download.warnings.msg.${warning.data}`});
      });

      this.ipcService.watch<string>("bs-download.[Error]").pipe(filter(v => !!v && !!v.data),  distinctUntilChanged(), throttleTime(1000)).subscribe(err => {
         this.notificationService.notifyError({title: "notifications.types.error", desc: `notifications.bs-download.errors.msg.${err.data}`});
      });

      this.ipcService.watch<void>("bs-download.[2FA]").subscribe(async response => {
         if(!response.success){ this.ipcService.sendLazy("bs-download.kill"); return; }
         const res = await this.modalService.openModal(ModalType.GUARD_CODE);
         if(res.exitCode !== ModalExitCode.COMPLETED){
            this.progressBarService.hide(true);
            this.ipcService.sendLazy("bs-download.kill"); 
            return; 
        }
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

   public cancelDownload(): Promise<IpcResponse<boolean>>{
      return this.ipcService.send<boolean>("bs-download.kill");
   }

   public async download(bsVersion: BSVersion, isVerification?: boolean, isFirstCall = true): Promise<IpcResponse<DownloadEvent>>{
      if(isFirstCall && !this.progressBarService.require()){ return {success: false}; }

      this.progressBarService.show(this.downloadProgress$);
      this._isVerification = !!isVerification;

      let promise;
      if(!this.authService.sessionExist()){
         const res = await this.modalService.openModal<{username: string, stay: boolean, password: string}>(ModalType.STEAM_LOGIN);
         if(res.exitCode !== ModalExitCode.COMPLETED){
            this.progressBarService.hide(true);
            return {success: false}; 
        }
         this.authService.setSteamSession(res.data.username, res.data.stay);
         promise = this.ipcService.send<DownloadEvent>('bs-download.start', {args: {bsVersion, username: res.data.username, password: res.data.password, stay: res.data.stay}});
      }
      else{
         promise = this.ipcService.send<DownloadEvent>('bs-download.start', {args: {bsVersion, username: this.authService.getSteamUsername()}});
      }

      this.currentBsVersionDownload$.next(bsVersion);

      let res = await promise;
        
      if(res.data?.type === "[Password]"){
         this.authService.deleteSteamSession();
         res = await this.download(bsVersion, isVerification, false);
      }
      
      this.progressBarService.hide(true);
      this.resetDownload();
      if(res.success && isFirstCall){ this.notificationService.notifySuccess({title: `notifications.bs-download.success.titles.${isVerification ? "verification-finished" : "download-success"}`, duration: 3000}); }
      else if(res.data && isFirstCall){ console.log("aaaa"); this.notificationService.notifyError({title: `notifications.types.error`, desc: `notifications.bs-download.errors.msg.${res.data}`, duration: 3000}); }

      return res;
   }

   public get isDownloading(): boolean{ return !!this.currentBsVersionDownload$.value; }
   public get isVerification(): boolean{ return this._isVerification; }

   public async getInstallationFolder(): Promise<string>{
      const res = await this.ipcService.send<string>("bs-download.installation-folder");
      return res.success ? res.data : "";
   }

   public setInstallationFolder(path: string): Promise<IpcResponse<string>>{
      return this.ipcService.send<string>("bs-download.set-installation-folder", {args: path});
   }

}
