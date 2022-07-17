import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service';
import { BSInstallerService } from '../services/bs-installer.service';
import { BSVersionManagerService } from '../services/bs-version-manager.service'
import { BSVersion } from "main/services/bs-version-manager.service";
import path from 'path';
import { exec } from 'child_process';
import { SteamService } from '../services/steam.service';
import { BS_APP_ID } from '../constants';
import { IpcRequest } from 'shared/models/ipc-models.model';

ipcMain.on('bs-version.request-versions', (event, req: IpcRequest<void>) => {
   BSVersionManagerService.getInstance().getAvailableVersions().then(versions => {
      UtilsService.getInstance().newIpcSenc(req.responceChannel, {success: true, data: versions});
   }).catch(() => {
      UtilsService.getInstance().newIpcSenc(req.responceChannel, {success: false});
   })
});

ipcMain.on('bs-version.installed-versions', async (event, req: IpcRequest<void>) => {
   BSInstallerService.getInstance().getInstalledBsVersion().then(versions => {
      UtilsService.getInstance().newIpcSenc(req.responceChannel, {success: true, data: versions});
   }).catch(() => {
      UtilsService.getInstance().newIpcSenc(req.responceChannel, {success: false});
   })
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
