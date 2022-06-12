import { BehaviorSubject } from 'rxjs';
import { DownloadInfo } from '../../main/ipcs/bs-download-ipcs';
import { BSVersion } from '../../main/services/bs-version-manager.service'
import { BSVersionManagerService } from './bs-version-manager.service';
import { ModalExitCode, ModalService, ModalType } from './modale.service';

export class BsDownloaderService{

    private static instance: BsDownloaderService;

    private readonly modalService: ModalService = ModalService.getInsance();
    private readonly bsVersionManager: BSVersionManagerService = BSVersionManagerService.getInstance();

    public readonly currentBsVersionDownload$: BehaviorSubject<BSVersion> = new BehaviorSubject(null);
    public readonly downloadProgress$: BehaviorSubject<number> = new BehaviorSubject(0);

    public readonly selectedBsVersion$: BehaviorSubject<BSVersion> = new BehaviorSubject(null);

    public static getInstance(): BsDownloaderService{
        if(!BsDownloaderService.instance){ BsDownloaderService.instance = new BsDownloaderService(); }
        return BsDownloaderService.instance;
    }

    private constructor(){
        this.asignListerners();
    }

    private asignListerners(): void{
        window.electron.ipcRenderer.on(`bs-download.[Password]`, async (bsVersion: BSVersion) => {
            const res = await this.modalService.openModal(ModalType.STEAM_LOGIN);
            if(res.exitCode !== ModalExitCode.COMPLETED){ return; }
            if(res.data.stay){ localStorage.setItem("username", res.data.username); }
            window.electron.ipcRenderer.sendMessage('bs-download.start', {bsVersion: bsVersion, username: res.data.username, password: res.data.password, stay: res.data.stay} as DownloadInfo)
            this.currentBsVersionDownload$.next(bsVersion);
        });

        window.electron.ipcRenderer.on("bs-download.[Guard]", async () => {
            const res = await this.modalService.openModal(ModalType.GUARD_CODE);
            if(res.exitCode != ModalExitCode.COMPLETED){ return; }
            window.electron.ipcRenderer.sendMessage("bs-download.[Guard]", res.data);
        });

        window.electron.ipcRenderer.on("bs-download.[Finished]", async () => {
            this.downloadProgress$.next(0);
            this.currentBsVersionDownload$.next(null);
            this.selectedBsVersion$.next(null);
            this.bsVersionManager.askInstalledVersions();
        });

        window.electron.ipcRenderer.on("bs-download.[Progress]", async (progress: number) => {
            this.downloadProgress$.next(progress);
        });

        window.electron.ipcRenderer.on("bs-download.[Error]", async () => {
            this.currentBsVersionDownload$.next(null);
            this.downloadProgress$.next(0);
        });

        this.currentBsVersionDownload$.subscribe(version => {
            if(version){ this.bsVersionManager.setInstalledVersions([...this.bsVersionManager.installedVersions$.value, version]); }
            else{ this.bsVersionManager.askInstalledVersions(); }
        });
    }

    public async download(bsVersion?: BSVersion): Promise<void>{
        if(!bsVersion){ bsVersion = this.selectedBsVersion$.value; }
        let username = localStorage.getItem("username");
        if(!username){
            const res = await this.modalService.openModal(ModalType.STEAM_LOGIN);
            if(res.exitCode !== ModalExitCode.COMPLETED){ return; }
            if(res.data.stay){ localStorage.setItem("username", res.data.username); }
            window.electron.ipcRenderer.sendMessage('bs-download.start', {bsVersion: bsVersion, username: res.data.username, password: res.data.password, stay: res.data.stay} as DownloadInfo);
        }
        else{
            window.electron.ipcRenderer.sendMessage('bs-download.start', {bsVersion: bsVersion, username: username} as DownloadInfo);
        }
        this.currentBsVersionDownload$.next(bsVersion);
    }

}
