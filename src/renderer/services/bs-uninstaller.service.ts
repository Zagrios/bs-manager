import { BSVersion } from "main/services/bs-version-manager.service";
import { IpcService } from "./ipc.service";

export class BSUninstallerService{

    private static instance: BSUninstallerService;

    private readonly ipcService: IpcService;

    public static getInstance(): BSUninstallerService{
        if(!BSUninstallerService.instance){ BSUninstallerService.instance = new BSUninstallerService(); }
        return BSUninstallerService.instance;
    }

    private constructor(){
      this.ipcService = IpcService.getInstance();
    };

   public async uninstall(version: BSVersion): Promise<boolean>{
      return (await this.ipcService.send("bs.uninstall", {args: version})).success;
   }

}