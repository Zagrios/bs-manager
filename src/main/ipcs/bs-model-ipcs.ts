import { ipcMain } from "electron";
import { UtilsService } from "../services/utils.service";
import { IpcRequest } from "shared/models/ipc";
import { MSModel } from "shared/models/model-saber/model-saber.model";
import { LocalModelsManagerService } from "../services/additional-content/local-models-manager.service";

ipcMain.on("one-click-install-model", async (event, request: IpcRequest<MSModel>) => {
    const utils = UtilsService.getInstance();
    const models = LocalModelsManagerService.getInstance();

    models.oneClickDownloadModel(request.args).then(() => {
        utils.ipcSend(request.responceChannel, {success: true});
    }).catch(e => {
        utils.ipcSend(request.responceChannel, {success: false, error: e});
    })
});