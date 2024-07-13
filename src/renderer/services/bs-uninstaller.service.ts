import { BSVersion } from "shared/bs-version.interface";
import { IpcService } from "./ipc.service";
import { lastValueFrom } from "rxjs";

export class BSUninstallerService {
    private static instance: BSUninstallerService;

    private readonly ipcService: IpcService;

    public static getInstance(): BSUninstallerService {
        if (!BSUninstallerService.instance) {
            BSUninstallerService.instance = new BSUninstallerService();
        }
        return BSUninstallerService.instance;
    }

    private constructor() {
        this.ipcService = IpcService.getInstance();
    }

    public uninstall(version: BSVersion): Promise<boolean> {
        return lastValueFrom(this.ipcService.sendV2("bs.uninstall", version)).catch(() => false);
    }
}
