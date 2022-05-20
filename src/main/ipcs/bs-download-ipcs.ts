import { ipcMain } from 'electron';
import path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { UtilsService } from '../services/utils.service';
import { BSVersion } from '../services/bs-version-manager.service';
import { BSInstallerService, DownloadEventType } from '../services/bs-installer.service';


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

ipcMain.on(`bs-download${DownloadEventType.GUARD_CODE}`, async (event, args) => {
  BSInstallerService.getInstance().sendInputProcess(args);
})


