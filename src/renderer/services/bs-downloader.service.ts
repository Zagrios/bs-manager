import { DownloadEvent } from 'main/services/bs-installer.service';
import { BehaviorSubject, distinctUntilChanged, Observable, Subscription } from 'rxjs';
import { IpcResponse } from 'shared/models/ipc-models.model';
import { DownloadInfo } from '../../main/ipcs/bs-download-ipcs';
import { BSVersion } from '../../main/services/bs-version-manager.service'
import { AuthUserService } from './auth-user.service';
import { BSVersionManagerService } from './bs-version-manager.service';
import { ConfigurationService } from './configuration.service';
import { IpcService } from './ipc.service';
import { ModalExitCode, ModalService, ModalType } from './modale.service';

export class BsDownloaderService{

    private static instance: BsDownloaderService;

    private readonly modalService: ModalService;
    private readonly ipcService: IpcService;
    private readonly bsVersionManager: BSVersionManagerService;
    private readonly authService: AuthUserService;

    public readonly currentBsVersionDownload$: BehaviorSubject<BSVersion> = new BehaviorSubject(null);
    public readonly downloadProgress$: BehaviorSubject<number> = new BehaviorSubject(0);
    public readonly downloadWarning$: BehaviorSubject<string> = new BehaviorSubject(null);

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
        this.asignListerners();
    }

    private asignListerners(): void{
        
        this.ipcService.watch<number>("bs-download.[Progress]").pipe(distinctUntilChanged()).subscribe(response => this.downloadProgress$.next(response.data));

        this.ipcService.watch<string>("bs-download.[SteamID]").subscribe(response =>  response.success && this.authService.setSteamID(response.data));

        this.ipcService.watch<string>("bs-download.[Warning]").subscribe(response => response.success && this.downloadWarning$.next(response.data));

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

    public async send2FA(): Promise<IpcResponse<DownloadEvent>>{
        const res = await this.modalService.openModal(ModalType.GUARD_CODE);
        if(res.exitCode !== ModalExitCode.COMPLETED){ return {success: false}; }

        return this.ipcService.send<DownloadEvent>('bs-download.2FA', {args: res.data});
    }

    public async download(bsVersion: BSVersion): Promise<IpcResponse<DownloadEvent>>{
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

        return promise.then(async res => {
            if(!res.success){ return res; }
            if(res.data.type === "[Password]"){
                this.authService.deleteSteamSession();
                res = await this.download(bsVersion);
            }
            else if(res.data.type === "[2FA]"){
                res = await this.send2FA();
            }
            this.resetDownload();
            return res;
        });
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
