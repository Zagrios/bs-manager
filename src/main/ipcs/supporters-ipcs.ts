import { ipcMain } from "electron";
import { SupportersService } from "../services/supporters.service";
import { IpcRequest } from "shared/models/ipc";
import { UtilsService } from '../services/utils.service';

ipcMain.on("get-supporters", (event, request: IpcRequest<void>) => {
    const utils = UtilsService.getInstance();
    const supportersService = SupportersService.getInstance();

    supportersService.getSupporters().then(supporters => {
        utils.ipcSend(request.responceChannel, {success: true, data: supporters});
    }).catch(() => {
        utils.ipcSend(request.responceChannel, {success: false});
    });
});