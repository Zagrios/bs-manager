import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service'
import { LaunchOption } from "shared/models/bs-launch";
import { BSLauncherService } from "../services/bs-launcher.service"
import { IpcRequest } from 'shared/models/ipc';
import { BsmException } from 'shared/models/bsm-exception.model';
import { IpcService } from '../services/ipc.service';

// ipcMain.on('bs-launch.launch', (event, request: IpcRequest<LauchOption>) => {
//   const launcherService = BSLauncherService.getInstance();
//   const utilsService = UtilsService.getInstance();

//   launcherService.launch(request.args).then(res => {
//     utilsService.ipcSend(request.responceChannel, {success: true, data: res});
//   }).catch((err: BsmException) => {
//     utilsService.ipcSend(request.responceChannel, {success: false, error: err});
//   })
// });

const ipc = IpcService.getInstance();

ipc.on('bs-launch.launch', async (req: IpcRequest<LaunchOption>, reply) => {
    const bsLauncher = BSLauncherService.getInstance();
    reply(bsLauncher.launchV2(req.args));
});
