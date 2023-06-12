import { ipcMain } from "electron";
import { IpcRequest } from "shared/models/ipc";
import { ModelSaberService } from "../services/thrid-party/model-saber/model-saber.service";
import { UtilsService } from "../services/utils.service";
import { IpcService } from "../services/ipc.service";
import { MSGetQuery } from "shared/models/models/model-saber.model";

const ipc = IpcService.getInstance();

ipcMain.on("ms-get-model-by-id", async (event, request: IpcRequest<string|number>) => {
    const utils = UtilsService.getInstance();
    const ms = ModelSaberService.getInstance();

    ms.getModelById(request.args).then(model => {
        utils.ipcSend(request.responceChannel, {success: true, data: model});
    }).catch(e => {
        utils.ipcSend(request.responceChannel, {success: false, error: e});
    })
});

ipc.on<MSGetQuery>("search-models", async (req, reply) => {
    const ms = ModelSaberService.getInstance();
    reply(ms.searchModels(req.args));
});