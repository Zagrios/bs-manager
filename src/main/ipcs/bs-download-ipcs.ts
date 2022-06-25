import { ipcMain } from 'electron';
import { BSVersion } from '../services/bs-version-manager.service';
import { BSInstallerService, DownloadEventType } from '../services/bs-installer.service';
import { IpcRequest } from '../../shared/models/ipc-models.model';
import { InstallationLocationService } from '../services/installation-location.service';
import { UtilsService } from '../services/utils.service';


export interface InitDownloadInfoInterface {
  cwd: string ,
  folder: string,
  app: string,
  depot: string,
  manifest: string,
  username: string,
  stay: boolean
}

export interface DownloadInfo {
  bsVersion: BSVersion,
  username: string,
  password?: string,
  stay?: boolean
}

ipcMain.on('bs-download.start', async (event, args: DownloadInfo) => {
  BSInstallerService.getInstance().downloadBsVersion(args);
});

ipcMain.on(`bs-download.${DownloadEventType.GUARD_CODE}`, async (event, args) => {
  BSInstallerService.getInstance().sendInputProcess(args);
});

ipcMain.on('bs-download.installation-folder', async (event, request: IpcRequest<void>) => {
  const installationFolder = InstallationLocationService.getInstance().installationDirectory;
  UtilsService.getInstance().newIpcSenc(request.responceChannel, {success: true, data: installationFolder});
});

ipcMain.on('bs-download.set-installation-folder', (event, request: IpcRequest<string>) => {
  const installerService = InstallationLocationService.getInstance();
  installerService.setInstallationDirectory(request.args).then(res => {
    console.log("déplacement terminer");
    UtilsService.getInstance().newIpcSenc(request.responceChannel, {success: true, data: res});
  }).catch(err => {
    console.log(err);
    UtilsService.getInstance().newIpcSenc(request.responceChannel, {success: false, error: err});
  });
})


