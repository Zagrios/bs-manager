import { ipcMain } from "electron";
import { BsModsManagerService } from "../services/mods/bs-mods-manager.service";
import { UtilsService } from "../services/utils.service";
import { BSVersion } from "shared/bs-version.interface";
import { IpcRequest } from "shared/models/ipc";
import { Mod } from "shared/models/mods/mod.interface";
import { InstallModsResult } from "shared/models/mods";
import log from "electron-log";

ipcMain.on("get-available-mods", (event, request: IpcRequest<BSVersion>) => {
    const utils = UtilsService.getInstance();
    const modsManager = BsModsManagerService.getInstance();

    modsManager
        .getAvailableMods(request.args)
        .then(mods => {
            utils.ipcSend(request.responceChannel, { success: true, data: mods });
        })
        .catch(err => {
            utils.ipcSend(request.responceChannel, { success: false });
            log.error("ipc", "get-available-mods", err, request);
        });
});

ipcMain.on("get-installed-mods", (event, request: IpcRequest<BSVersion>) => {
    const utils = UtilsService.getInstance();
    const modsManager = BsModsManagerService.getInstance();

    modsManager
        .getInstalledMods(request.args)
        .then(mods => {
            utils.ipcSend(request.responceChannel, { success: true, data: mods });
        })
        .catch(err => {
            utils.ipcSend(request.responceChannel, { success: false });
            log.error("ipc", "get-installed-mods", err, request);
        });
});

ipcMain.on("install-mods", (event, request: IpcRequest<{ mods: Mod[]; version: BSVersion }>) => {
    const utils = UtilsService.getInstance();
    const modsManager = BsModsManagerService.getInstance();

    modsManager
        .installMods(request.args.mods, request.args.version)
        .then(nbInstalled => {
            utils.ipcSend<InstallModsResult>(request.responceChannel, { success: true, data: nbInstalled });
        })
        .catch(err => {
            utils.ipcSend(request.responceChannel, { success: false, error: err });
            log.error("ipc", "install-mods", err, request);
        });
});

ipcMain.on("uninstall-mods", (event, request: IpcRequest<{ mods: Mod[]; version: BSVersion }>) => {
    const utils = UtilsService.getInstance();
    const modsManager = BsModsManagerService.getInstance();

    modsManager
        .uninstallMods(request.args.mods, request.args.version)
        .then(nbInstalled => {
            utils.ipcSend(request.responceChannel, { success: true, data: nbInstalled });
        })
        .catch(err => {
            utils.ipcSend(request.responceChannel, { success: false, error: err });
            log.error("ipc", "uninstall-mods", err, request);
        });
});

ipcMain.on("uninstall-all-mods", (event, request: IpcRequest<BSVersion>) => {
    const utils = UtilsService.getInstance();
    const modsManager = BsModsManagerService.getInstance();

    modsManager
        .uninstallAllMods(request.args)
        .then(nbInstalled => {
            utils.ipcSend(request.responceChannel, { success: true, data: nbInstalled });
        })
        .catch(err => {
            utils.ipcSend(request.responceChannel, { success: false, error: err });
            log.error("ipc", "uninstall-all-mods", err, request);
        });
});
