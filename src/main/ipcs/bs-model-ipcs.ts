import { ipcMain } from "electron";
import { UtilsService } from "../services/utils.service";
import { IpcRequest } from "shared/models/ipc";
import { MSModel, MSModelType } from "shared/models/models/model-saber.model";
import { LocalModelsManagerService } from "../services/additional-content/local-models-manager.service";
import { IpcService } from "../services/ipc.service";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { from } from "rxjs";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";

const ipc = IpcService.getInstance();

ipcMain.on("one-click-install-model", async (event, request: IpcRequest<MSModel>) => {
    const utils = UtilsService.getInstance();
    const models = LocalModelsManagerService.getInstance();

    models.oneClickDownloadModel(request.args).then(() => {
        utils.ipcSend(request.responceChannel, {success: true});
    }).catch(e => {
        utils.ipcSend(request.responceChannel, {success: false, error: e});
    })
});

ipcMain.on("register-models-deep-link", async (event, request: IpcRequest<void>) => {
    
    const maps = LocalModelsManagerService.getInstance();
    const utils = UtilsService.getInstance();

    try{
        const res = maps.enableDeepLinks();
        utils.ipcSend(request.responceChannel, {success: true, data: res});
    }
    catch(e){
        utils.ipcSend(request.responceChannel, {success: false});
    }

});

ipcMain.on("unregister-models-deep-link", async (event, request: IpcRequest<void>) => {
    
    const maps = LocalModelsManagerService.getInstance();
    const utils = UtilsService.getInstance();

    try{
        const res = maps.disableDeepLinks();
        utils.ipcSend(request.responceChannel, {success: true, data: res});
    }
    catch(e){
        utils.ipcSend(request.responceChannel, {success: false});
    }
    
});

ipcMain.on("is-models-deep-links-enabled", async (event, request: IpcRequest<void>) => {

    const maps = LocalModelsManagerService.getInstance();
    const utils = UtilsService.getInstance();

    try{
        const res = maps.isDeepLinksEnabled();
        utils.ipcSend(request.responceChannel, {success: true, data: res});
    }
    catch(e){
        utils.ipcSend(request.responceChannel, {success: false});
    }

});

ipc.on<{version: BSVersion, type: MSModelType}>("get-version-models", async (req, reply) => {
    const models = LocalModelsManagerService.getInstance();
    const res = await models.getModels(req.args.type, req.args.version);
    reply(res);
});

ipc.on<{version: BSVersion, models: BsmLocalModel[], outPath: string}>("export-models", async (req, reply) => {
    const models = LocalModelsManagerService.getInstance();
    reply(await models.exportModels(req.args.outPath, req.args.version, req.args.models));
});

ipc.on<BsmLocalModel[]>("delete-models", async (req, reply) => {
    const models = LocalModelsManagerService.getInstance();
    reply(models.deleteModels(req.args));
});