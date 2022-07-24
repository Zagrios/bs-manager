import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service';
import { BSVersionLibService } from '../services/bs-version-lib.service'
import { BSVersion } from 'shared/bs-version.interface';
import path from 'path';
import { exec } from 'child_process';
import { SteamService } from '../services/steam.service';
import { BS_APP_ID } from '../constants';
import { IpcRequest } from 'shared/models/ipc';
import { BSLocalVersionService } from '../services/bs-local-version.service';
import { InstallationLocationService } from '../services/installation-location.service';
import { BsmException } from 'shared/models/bsm-exception.model';

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
   const localVersionService = BSLocalVersionService.getInstance();
   const versionFolder = await localVersionService.getVersionPath(req.args);
   UtilsService.getInstance().pathExist(versionFolder) && exec(`start "" "${versionFolder}"`);
});

ipcMain.on("bs-version.edit", async (event, req: IpcRequest<{version: BSVersion, name: string, color: string}>) => {
   BSLocalVersionService.getInstance().editVersion(req.args.version, req.args.name, req.args.color).then(res => {
      console.log(res);
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: !!res, data: res});
   }).catch((error: BsmException) => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: false, error});
      console.log(error);
   });
});

ipcMain.on("bs-version.clone", async (event, req: IpcRequest<{version: BSVersion, name: string, color: string}>) => {
   BSLocalVersionService.getInstance().cloneVersion(req.args.version, req.args.name, req.args.color).then(res => {
      console.log(res);
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: !!res, data: res});
   }).catch((error: BsmException) => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: false, error});
      console.log(error);
   });
});
