import { ipcMain } from "electron";
import { BSUninstallerService } from "../services/bs-uninstaller.service";
import { BSVersion } from "main/services/bs-version-manager.service";
import { UtilsService } from "../services/utils.service";
import { IpcRequest } from "shared/models/ipc-models.model";

ipcMain.on('bs.uninstall', async (event, request: IpcRequest<BSVersion>) => {

    const bsUninstallerService = BSUninstallerService.getInstance();
    const utilsService = UtilsService.getInstance();

    if(!request.args){ utilsService.newIpcSenc(request.responceChannel, {success: false}); }

    const res = await bsUninstallerService.uninstall(request.args);
    utilsService.newIpcSenc(request.responceChannel, {success: res});
});