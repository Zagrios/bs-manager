import { BSVersion } from "../../main/services/bs-version-manager.service";
import { BehaviorSubject } from "rxjs";

export class BSVersionManagerService {

    private static instance: BSVersionManagerService;

    public readonly installedVersions$: BehaviorSubject<BSVersion[]> = new BehaviorSubject([]);
    public readonly availableVersions$: BehaviorSubject<BSVersion[]> = new BehaviorSubject([]);

    private constructor(){
        window.electron.ipcRenderer.on('bs-version.request-versions', (versions: BSVersion[]) => {
            this.availableVersions$.next(versions);
        });
        window.electron.ipcRenderer.on('bs-version.installed-versions', (versions: BSVersion[]) => {
            this.setInstalledVersions(versions);
        });

        this.askAvailableVersions();
        this.askInstalledVersions();
    }

    public static getInstance(){
        if(!BSVersionManagerService.instance){ BSVersionManagerService.instance = new BSVersionManagerService(); }
        return BSVersionManagerService.instance;
    }

    public setInstalledVersions(versions: BSVersion[]){
        const sorted: BSVersion[] = versions.sort((a, b) => +b.ReleaseDate - +a.ReleaseDate)
        const steamIndex = sorted.findIndex(v => v.steam);
        if(steamIndex > 0){
            [sorted[0], sorted[steamIndex]] = [sorted[steamIndex], sorted[0]];
        }
        const cleanedSort = [...new Map(sorted.map(version => [`${version.BSVersion}-${version.steam}`, version])).values()]
        this.installedVersions$.next(cleanedSort);
    }

    public getInstalledVersions(): BSVersion[]{
        return this.installedVersions$.value;
    }

    public askAvailableVersions(): void{
        window.electron.ipcRenderer.sendMessage("bs-version.request-versions", null);
    }

    public askInstalledVersions(): void{
        window.electron.ipcRenderer.sendMessage("bs-version.installed-versions", null);
    }

    public getAvailableYears(): string[]{
      return [...new Set(this.availableVersions$.value.map(v => v.year))].sort((a, b) => b.localeCompare(a));
    }

    public getAvaibleVersionsOfYear(year: string): BSVersion[]{
      return this.availableVersions$.value.filter(v => v.year === year).sort((a, b) => +b.ReleaseDate - +a.ReleaseDate);
    }

}
