import { ipcMain } from "electron";
import { AutoUpdaterService } from "../services/auto-updater.service";
import { IpcRequest } from "shared/models/ipc";
import { UtilsService } from "../services/utils.service";

ipcMain.on("download-update", async (event, request: IpcRequest<void>) => {
    
    const updaterService = AutoUpdaterService.getInstance();
    const utilsService = UtilsService.getInstance();

    updaterService.downloadUpdate().then(res => utilsService.ipcSend(request.responceChannel, {success: res}))
    .catch(() => utilsService.ipcSend(request.responceChannel, {success: false}));

});

ipcMain.on("check-update", async (event, request: IpcRequest<void>) => {
    
    const updaterService = AutoUpdaterService.getInstance();
    const utilsService = UtilsService.getInstance();

    updaterService.isUpdateAvailable().then(updateAvailable => {
        utilsService.ipcSend(request.responceChannel, {success: true, data: updateAvailable});
    })
    .catch(() => utilsService.ipcSend(request.responceChannel, {success: false}));

});

ipcMain.on("install-update", async (event, request: IpcRequest<void>) => {
    const updaterService = AutoUpdaterService.getInstance();
    updaterService.quitAndInstall();
});