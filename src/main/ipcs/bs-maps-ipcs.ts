
import { LocalMapsManagerService } from "../services/additional-content/local-maps-manager.service";
import { UtilsService } from "../services/utils.service";
import { BSVersion } from "shared/bs-version.interface";
import { IpcRequest } from "shared/models/ipc";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { BsvMapDetail } from "shared/models/maps";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on('load-version-maps', async (request: IpcRequest<BSVersion>, reply) => {
    const localMaps = LocalMapsManagerService.getInstance();
    reply(localMaps.getMaps(request.args));
});

ipc.on("verion-have-maps-linked", async (request: IpcRequest<BSVersion>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    utils.ipcSend<boolean>(request.responceChannel, {success: true, data: await maps.versionIsLinked(request.args)});

  });

ipc.on("link-version-maps", async (request: IpcRequest<{version: BSVersion, keepMaps: boolean}>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    maps.linkVersionMaps(request.args.version, request.args.keepMaps).then(() => {
        utils.ipcSend<void>(request.responceChannel, {success: true});
    }).catch(err => {
        utils.ipcSend<void>(request.responceChannel, {success: true, error: err});
    });

});

ipc.on("unlink-version-maps", async (request: IpcRequest<{version: BSVersion, keepMaps: boolean}>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    maps.unlinkVersionMaps(request.args.version, request.args.keepMaps).then(() => {
        utils.ipcSend<void>(request.responceChannel, {success: true});
    }).catch(err => {
        utils.ipcSend<void>(request.responceChannel, {success: true, error: err});
    });

});

ipc.on("delete-maps", async (request: IpcRequest<BsmLocalMap[]>, reply) => {
    const maps = LocalMapsManagerService.getInstance();
    reply(maps.deleteMaps(request.args));
});

ipc.on("export-maps", async (request: IpcRequest<{version: BSVersion, maps: BsmLocalMap[], outPath: string}>, reply) => {
    const maps = LocalMapsManagerService.getInstance();
    reply(await maps.exportMaps(request.args.version, request.args.maps, request.args.outPath));
});

ipc.on("download-map", async (request: IpcRequest<{map: BsvMapDetail, version: BSVersion}>, reply) => {
    const maps = LocalMapsManagerService.getInstance();
    reply(from(maps.downloadMap(request.args.map, request.args.version)))
});

ipc.on("one-click-install-map", async (request: IpcRequest<BsvMapDetail>) => {
    const utils = UtilsService.getInstance();
    const maps = LocalMapsManagerService.getInstance();

    maps.oneClickDownloadMap(request.args).then(() => {
        utils.ipcSend(request.responceChannel, {success: true});
    }).catch(err => {
        utils.ipcSend(request.responceChannel, {success: false, error: err});
    });
});

ipc.on("register-maps-deep-link", async (request: IpcRequest<void>) => {
    
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

ipc.on("unregister-maps-deep-link", async (request: IpcRequest<void>) => {
    
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

ipc.on("is-map-deep-links-enabled", async (request: IpcRequest<void>) => {

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