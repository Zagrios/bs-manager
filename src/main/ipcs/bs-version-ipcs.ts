import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service';
import { BSInstallerService } from '../services/bs-installer.service';
import { BSVersionManagerService } from '../services/bs-version-manager.service'
import { BSVersion } from "main/services/bs-version-manager.service";
import path from 'path';
import { exec } from 'child_process';
import { SteamService } from '../services/steam.service';
import { BS_APP_ID } from '../constants';

ipcMain.on('bs-version.request-versions', async (event, args) => {
    UtilsService.getInstance().ipcSend('bs-version.request-versions', await BSVersionManagerService.getInstance().getAvailableVersions());
});

ipcMain.on('bs-version.installed-versions', async (event, args) => {
    UtilsService.getInstance().ipcSend('bs-version.installed-versions', await BSInstallerService.getInstance().getInstalledBsVersion())
});

ipcMain.on("bs-version.open-folder", async (event, args: BSVersion) => {
    const bsInstallerService =  BSInstallerService.getInstance();
    let versionFolder = ""
    if(args.steam){
        const steamService = SteamService.getInstance();
        versionFolder = await steamService.getGameFolder(BS_APP_ID, "Beat Saber");
        console.log(versionFolder)
    }
    else{
        versionFolder = path.join(bsInstallerService.installationFolder, args.BSVersion);
    }
    if(UtilsService.getInstance().folderExist(versionFolder)){
        exec(`start "" "${versionFolder}"`);
    }
})
