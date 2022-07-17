import { ipcMain } from "electron";
import { BSVersion } from 'shared/bs-version.interface';
import { UtilsService } from "../services/utils.service";
import { IpcRequest } from "shared/models/ipc";
import { BSLocalVersionService } from "../services/bs-local-version.service";

ipcMain.on('bs.uninstall', async (event, request: IpcRequest<BSVersion>) => {

    const bsLocalVersionService = BSLocalVersionService.getInstance();
    const utilsService = UtilsService.getInstance();

    if(!request.args){ utilsService.ipcSend(request.responceChannel, {success: false}); }

    const res = await bsLocalVersionService.deleteVersion(request.args);
    utilsService.ipcSend(request.responceChannel, {success: res});
});