import { ipcMain } from "electron";
import { BSVersion } from "main/services/bs-version-manager.service";
import { UtilsService } from "../services/utils.service";
import { IpcRequest } from "shared/models/ipc-models.model";
import { BSLocalVersionService } from "../services/bs-local-version.service";

ipcMain.on('bs.uninstall', async (event, request: IpcRequest<BSVersion>) => {

    const bsLocalVersionService = BSLocalVersionService.getInstance();
    const utilsService = UtilsService.getInstance();

    if(!request.args){ utilsService.newIpcSenc(request.responceChannel, {success: false}); }

    const res = await bsLocalVersionService.deleteVersion(request.args);
    utilsService.newIpcSenc(request.responceChannel, {success: res});
});