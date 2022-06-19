import { BSVersion } from "main/services/bs-version-manager.service";

export class BSUninstallerService{

    private static instance: BSUninstallerService;

    public static getInstance(): BSUninstallerService{
        if(!BSUninstallerService.instance){ BSUninstallerService.instance = new BSUninstallerService(); }
        return BSUninstallerService.instance;
    }

    private constructor(){};

    public async uninstall(version: BSVersion){

        const promise = new Promise<void>((reslove, reject) => {
            window.electron.ipcRenderer.once("bs.uninstall.error", (e) => {
                reject(e);
            })

            window.electron.ipcRenderer.once("bs.uninstall.success", () => {
                reslove();
            })
        });

        window.electron.ipcRenderer.sendMessage("bs.uninstall", version);

        return promise;
    }

}