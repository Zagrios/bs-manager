import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service'
import { LauchOption } from "shared/models/bs-launch";
import { BSLauncherService } from "../services/bs-launcher.service"
import { IpcRequest } from 'shared/models/ipc';
import { BsmException } from 'shared/models/bsm-exception.model';

ipcMain.on('bs-launch.launch', (event, request: IpcRequest<LauchOption>) => {
  const launcherService = BSLauncherService.getInstance();
  const utilsService = UtilsService.getInstance();

  launcherService.launch(request.args).then(res => {
    utilsService.ipcSend(request.responceChannel, {success: true, data: res});
  }).catch((err: BsmException) => {
    utilsService.ipcSend(request.responceChannel, {success: false, error: err});
  })
});
