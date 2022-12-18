import { ipcMain } from "electron";
import { LocalMapsManagerService } from "../services/maps/local-maps-manager.service";
import { UtilsService } from "../services/utils.service";
import { BSVersion } from "shared/bs-version.interface";
import { IpcRequest } from "shared/models/ipc";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { BsvMapDetail } from "shared/models/maps";

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

    utils.ipcSend<boolean>(request.responceChannel, {success: true, data: await maps.versionIsLinked(request.args)});

  });

ipcMain.on("link-version-maps", async (event, request: IpcRequest<{version: BSVersion, keepMaps: boolean}>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    maps.linkVersionMaps(request.args.version, request.args.keepMaps).then(() => {
        utils.ipcSend<void>(request.responceChannel, {success: true});
    }).catch(err => {
        utils.ipcSend<void>(request.responceChannel, {success: true, error: err});
    });

});

ipcMain.on("unlink-version-maps", async (event, request: IpcRequest<{version: BSVersion, keepMaps: boolean}>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    maps.unlinkVersionMaps(request.args.version, request.args.keepMaps).then(() => {
        utils.ipcSend<void>(request.responceChannel, {success: true});
    }).catch(err => {
        utils.ipcSend<void>(request.responceChannel, {success: true, error: err});
    });

});

ipcMain.on("delete-maps", async (event, request: IpcRequest<{version: BSVersion, maps: BsmLocalMap[]}>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    maps.deleteMaps(request.args.maps, request.args.version).then(() => {
        utils.ipcSend<void>(request.responceChannel, {success: true});
    }).catch(err => {
        utils.ipcSend<void>(request.responceChannel, {success: false, error: err});
    });
});

ipcMain.on("export-maps", async (event, request: IpcRequest<{version: BSVersion, maps: BsmLocalMap[], outPath: string}>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    maps.exportMaps(request.args.version, request.args.maps, request.args.outPath).then(() => {
        utils.ipcSend<void>(request.responceChannel, {success: true});
    }).catch(err => {
        utils.ipcSend<void>(request.responceChannel, {success: false, error: err});
    });
});

ipcMain.on("download-map", async (event, request: IpcRequest<{map: BsvMapDetail, version: BSVersion}>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    maps.downloadMap(request.args.map, request.args.version).then(() => {
        utils.ipcSend(request.responceChannel, {success: true});
    }).catch(err => {
        console.log(err);
        utils.ipcSend(request.responceChannel, {success: false, error: err});
    });
});

ipcMain.on("one-click-install-map", async (event, request: IpcRequest<BsvMapDetail>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    maps.oneClickDownloadMap(request.args).then(() => {
        utils.ipcSend(request.responceChannel, {success: true});
    }).catch(err => {
        console.log(err);
        utils.ipcSend(request.responceChannel, {success: false, error: err});
    });
});

ipcMain.on("register-maps-deep-link", async (event, request: IpcRequest<void>) => {
    
    const maps = LocalMapsManagerService.getInstance();
    const utils = UtilsService.getInstance();

    try{
        const res = maps.enableDeepLinks();
        utils.ipcSend(request.responceChannel, {success: true, data: res});
    }
    catch(e){
        utils.ipcSend(request.responceChannel, {success: false});
    }

});

ipcMain.on("unregister-maps-deep-link", async (event, request: IpcRequest<void>) => {
    
    const maps = LocalMapsManagerService.getInstance();
    const utils = UtilsService.getInstance();

    try{
        const res = maps.disableDeepLinks();
        utils.ipcSend(request.responceChannel, {success: true, data: res});
    }
    catch(e){
        utils.ipcSend(request.responceChannel, {success: false});
    }
    
});

ipcMain.on("is-map-deep-links-enabled", async (event, request: IpcRequest<void>) => {

    const maps = LocalMapsManagerService.getInstance();
    const utils = UtilsService.getInstance();

    try{
        const res = maps.isDeepLinksEnabled();
        utils.ipcSend(request.responceChannel, {success: true, data: res});
    }
    catch(e){
        utils.ipcSend(request.responceChannel, {success: false});
    }

});