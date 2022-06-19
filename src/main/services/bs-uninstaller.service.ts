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

    public async uninstall(version :BSVersion){
        if(version.steam){ throw "Cannot uninstall steam version"; }
        const versionFolder = path.join(this.bsInstallerService.getBSInstallationFolder(), version.BSVersion);
        if(!this.utilsService.folderExist(versionFolder)){ throw "Version folder not exist"; }

        return await this.utilsService.deleteFolder(versionFolder);
    }

}