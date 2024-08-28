import { Observable, lastValueFrom } from "rxjs";
import { IpcService } from "./ipc.service";


export class InstallationLocationService {

    private static instance: InstallationLocationService;

    private readonly ipcService: IpcService;

    public static getInstance(): InstallationLocationService {
        if (!InstallationLocationService.instance) {
            InstallationLocationService.instance = new InstallationLocationService();
        }
        return InstallationLocationService.instance;
    }

    private constructor() {
        this.ipcService = IpcService.getInstance();
    }

    public async getInstallationFolder(): Promise<string> {
        return lastValueFrom(this.ipcService.sendV2("bs-installer.install-path"));
    }

    public setInstallationFolder(path: string): Observable<string> {
        return this.ipcService.sendV2("bs-installer.set-install-path", path);
    }
}
