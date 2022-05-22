import { BSVersion } from "../../main/services/bs-version-manager.service";
import { BehaviorSubject } from "rxjs";

export class BSVersionManagerService {

    private static instance: BSVersionManagerService;

    public readonly installedVersions$: BehaviorSubject<BSVersion[]> = new BehaviorSubject([]);
    public readonly availableVersions$: BehaviorSubject<BSVersion[]> = new BehaviorSubject([]);

    private constructor(){
        window.electron.ipcRenderer.on('bs-version.request-versions', (versions: BSVersion[]) => {
            this.availableVersions$.next(versions);
            console.log("ouiiii");
            console.log(this.availableVersions$.value);
        });
        window.electron.ipcRenderer.on('bs-version.installed-versions', (versions: BSVersion[]) => {
            this.installedVersions$.next(versions);
        });

        this.askAvailableVersions();
        this.askInstalledVersions();
    }

    public static getInstance(){
        if(!BSVersionManagerService.instance){ BSVersionManagerService.instance = new BSVersionManagerService(); }
        return BSVersionManagerService.instance;
    }

    public askAvailableVersions(): void{
        window.electron.ipcRenderer.sendMessage("bs-version.request-versions", null);
    }

    public askInstalledVersions(): void{
        window.electron.ipcRenderer.sendMessage("bs-version.installed-versions", null);
    }

}