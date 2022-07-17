import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service'
import { LauchOption } from "shared/models/bs-launch";
import { BSLauncherService } from "../services/bs-launcher.service"
import { IpcRequest } from 'shared/models/ipc';

ipcMain.on('bs-launch.launch', (event, request: IpcRequest<LauchOption>) => {
  const launcherService = BSLauncherService.getInstance();
  const utilsService = UtilsService.getInstance();

  launcherService.launch(request.args).then(res => {
    utilsService.ipcSend(request.responceChannel, {success: true, data: res});
  }).catch(err => {
    utilsService.ipcSend(request.responceChannel, {success: false, error: {title: err, type: 'error'}});
  })
});
