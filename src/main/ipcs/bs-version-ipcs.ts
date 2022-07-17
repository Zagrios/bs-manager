import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service';
import { BSVersionManagerService } from '../services/bs-version-manager.service'
import { BSVersion } from "main/services/bs-version-manager.service";
import path from 'path';
import { exec } from 'child_process';
import { SteamService } from '../services/steam.service';
import { BS_APP_ID } from '../constants';
import { IpcRequest } from 'shared/models/ipc-models.model';
import { BSLocalVersionService } from '../services/bs-local-version.service';
import { InstallationLocationService } from '../services/installation-location.service';

ipcMain.on('bs-version.get-version-dict', (event, req: IpcRequest<void>) => {
   BSVersionManagerService.getInstance().getAvailableVersions().then(versions => {
      UtilsService.getInstance().newIpcSenc(req.responceChannel, {success: true, data: versions});
   }).catch(() => {
      UtilsService.getInstance().newIpcSenc(req.responceChannel, {success: false});
   })
});

ipcMain.on('bs-version.installed-versions', async (event, req: IpcRequest<void>) => {
   BSLocalVersionService.getInstance().getInstalledVersions().then(versions => {
      UtilsService.getInstance().newIpcSenc(req.responceChannel, {success: true, data: versions});
   }).catch(() => {
      UtilsService.getInstance().newIpcSenc(req.responceChannel, {success: false});
   })
});

ipcMain.on("bs-version.open-folder", async (event, args: BSVersion) => {
   const locationService = InstallationLocationService.getInstance();
   const versionFolder = args.steam ? await SteamService.getInstance().getGameFolder(BS_APP_ID, "Beat Saber") : path.join(locationService.versionsDirectory, args.BSVersion);
   UtilsService.getInstance().folderExist(versionFolder) && exec(`start "" "${versionFolder}"`);
});
