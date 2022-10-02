import { ipcMain } from "electron";
import { BsModsManagerService } from "../services/mods/bs-mods-manager.service";
import { UtilsService } from "../services/utils.service";
import { BSVersion } from "shared/bs-version.interface";
import { IpcRequest } from "shared/models/ipc";
import { Mod } from "shared/models/mods/mod.interface";

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

ipcMain.on("install-mods", (event, request: IpcRequest<{mods: Mod[], version: BSVersion}>) => {
    const utils = UtilsService.getInstance();
    const modsManager = BsModsManagerService.getInstance();

    modsManager.installMods(request.args.mods, request.args.version).then(nbInstalled => {
        utils.ipcSend(request.responceChannel, {success: true, data: nbInstalled})
    }).catch(err => {
        utils.ipcSend(request.responceChannel, {success: false, error: err});
    })
});

ipcMain.on("uninstall-mods", (event, request: IpcRequest<{mods: Mod[], version: BSVersion}>) => {
    const utils = UtilsService.getInstance();
    const modsManager = BsModsManagerService.getInstance();

    modsManager.uninstallMods(request.args.mods, request.args.version).then(nbInstalled => {
        utils.ipcSend(request.responceChannel, {success: true, data: nbInstalled})
    }).catch(err => {
        utils.ipcSend(request.responceChannel, {success: false, error: err});
    })
});

ipcMain.on("uninstall-all-mods", (event, request: IpcRequest<BSVersion>) => {
    const utils = UtilsService.getInstance();
    const modsManager = BsModsManagerService.getInstance();

    modsManager.uninstallAllMods(request.args).then(nbInstalled => {
        utils.ipcSend(request.responceChannel, {success: true, data: nbInstalled})
    }).catch(err => {
        utils.ipcSend(request.responceChannel, {success: false, error: err});
    })
});