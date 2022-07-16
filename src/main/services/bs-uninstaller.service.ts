import path from "path";
import { BSInstallerService } from "./bs-installer.service";
import { BSVersion } from "./bs-version-manager.service";
import { UtilsService } from "./utils.service";

export class BSUninstallerService {

    private static instance: BSUninstallerService;

    private readonly utilsService: UtilsService;
    private readonly bsInstallerService: BSInstallerService;

    public static getInstance(): BSUninstallerService {
        if(!BSUninstallerService.instance){ BSUninstallerService.instance = new BSUninstallerService(); }
        return BSUninstallerService.instance;
    }

    private constructor(){
        this.utilsService = UtilsService.getInstance();
        this.bsInstallerService = BSInstallerService.getInstance();
    }

   public async uninstall(version :BSVersion): Promise<boolean>{
      if(version.steam){ return false; }
      const versionFolder = path.join(this.bsInstallerService.installationFolder, version.BSVersion);
      if(!this.utilsService.folderExist(versionFolder)){ return true; }

      return this.utilsService.deleteFolder(versionFolder)
         .then(() => { return true; })
         .catch(() => { return false; })
   }

}