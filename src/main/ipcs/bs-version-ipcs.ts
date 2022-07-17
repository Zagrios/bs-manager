import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service';
import { BSVersionLibService } from '../services/bs-version-lib.service'
import { BSVersion } from "main/services/bs-version-lib.service";
import path from 'path';
import { exec } from 'child_process';
import { SteamService } from '../services/steam.service';
import { BS_APP_ID } from '../constants';
import { IpcRequest } from 'shared/models/ipc';
import { BSLocalVersionService } from '../services/bs-local-version.service';
import { InstallationLocationService } from '../services/installation-location.service';

ipcMain.on('bs-version.get-version-dict', (event, req: IpcRequest<void>) => {
   BSVersionLibService.getInstance().getAvailableVersions().then(versions => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: true, data: versions});
   }).catch(() => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: false});
   })
});

ipcMain.on('bs-version.installed-versions', async (event, req: IpcRequest<void>) => {
   BSLocalVersionService.getInstance().getInstalledVersions().then(versions => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: true, data: versions});
   }).catch(() => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: false});
   })
});

ipcMain.on("bs-version.open-folder", async (event, req: IpcRequest<BSVersion>) => {
   const locationService = InstallationLocationService.getInstance();
   const versionFolder = req.args.steam ? await SteamService.getInstance().getGameFolder(BS_APP_ID, "Beat Saber") : path.join(locationService.versionsDirectory, req.args.BSVersion);
   UtilsService.getInstance().folderExist(versionFolder) && exec(`start "" "${versionFolder}"`);
});
