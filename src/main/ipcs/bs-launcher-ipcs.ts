import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service'
import { LauchOption } from "../../shared/models/launch-models.model";
import { BSLauncherService } from "../services/bs-launcher.service"
import { IpcRequest } from 'shared/models/ipc-models.model';

ipcMain.on('bs-launch.launch', (event, request: IpcRequest<LauchOption>) => {
  const launcherService = BSLauncherService.getInstance();
  const utilsService = UtilsService.getInstance();

  launcherService.launch(request.args).then(res => {
    utilsService.newIpcSenc(request.responceChannel, {success: true, data: res});
  }).catch(err => {
    utilsService.newIpcSenc(request.responceChannel, {success: false, error: {title: err, type: 'error'}});
  })
});
