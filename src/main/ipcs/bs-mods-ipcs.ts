import { ipcMain } from "electron";
import { BsModsManagerService } from "../services/mods/bs-mods-manager.service";
import { UtilsService } from "../services/utils.service";
import { BSVersion } from "shared/bs-version.interface";
import { IpcRequest } from "shared/models/ipc";

ipcMain.on("get-available-mods", (event, request: IpcRequest<BSVersion>) => {
    const utils = UtilsService.getInstance();
    const modsManager = BsModsManagerService.getInstance();

    modsManager.getAvailableMods(request.args).then(mods => {
        utils.ipcSend(request.responceChannel, {success: true, data: mods});
    }).catch(() => utils.ipcSend(request.responceChannel, {success: false}));
});

ipcMain.on("get-installed-mods", (event, request: IpcRequest<BSVersion>) => {
    const utils = UtilsService.getInstance();
    const modsManager = BsModsManagerService.getInstance();

    modsManager.getInstalledMods(request.args).then(mods => {
        utils.ipcSend(request.responceChannel, {success: true, data: mods});
    }).catch(() => utils.ipcSend(request.responceChannel, {success: false}));
});