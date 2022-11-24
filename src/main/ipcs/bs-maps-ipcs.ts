import { ipcMain } from "electron";
import { LocalMapsManagerService } from "../services/maps/local-maps-manager.service";
import { UtilsService } from "../services/utils.service";
import { BSVersion } from "shared/bs-version.interface";
import { IpcRequest } from "shared/models/ipc";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";

ipcMain.on('get-version-maps', (event, request: IpcRequest<BSVersion>) => {
    const utilsService = UtilsService.getInstance();
    const localMaps = LocalMapsManagerService.getInstance();

    localMaps.getMaps(request.args).then(maps => {
        utilsService.ipcSend<BsmLocalMap[]>(request.responceChannel, {success: true, data: maps});
    }).catch(() => {
        utilsService.ipcSend(request.responceChannel, {success: false});
    })
    
});

ipcMain.on("verion-have-maps-linked", async (event, request: IpcRequest<BSVersion>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    console.log(request.args);
    utils.ipcSend<boolean>(request.responceChannel, {success: true, data: await maps.versionIsLinked(request.args)});

  });