import { ipcMain } from "electron";
import { AutoUpdaterService } from "../services/auto-updater.service";
import { IpcRequest } from "shared/models/ipc";
import { UtilsService } from "../services/utils.service";
import { IpcService } from "../services/ipc.service";
import { from, of } from "rxjs";

const ipc = IpcService.getInstance();
ipcMain.on("download-update", async (event, request: IpcRequest<void>) => {
    const updaterService = AutoUpdaterService.getInstance();
    const utilsService = UtilsService.getInstance();

    updaterService
        .downloadUpdate()
        .then(res => utilsService.ipcSend(request.responceChannel, { success: res }))
        .catch(() => utilsService.ipcSend(request.responceChannel, { success: false }));
});

ipc.on("check-update", (_, reply) => {
    const updaterService = AutoUpdaterService.getInstance();
    reply(from(updaterService.isUpdateAvailable()));
});

ipcMain.on("install-update", async (event, request: IpcRequest<void>) => {
    const updaterService = AutoUpdaterService.getInstance();
    updaterService.quitAndInstall();
});

ipc.on("have-been-updated", async (req : IpcRequest<void>, reply) => {
  const updaterService = AutoUpdaterService.getInstance();
  reply(of(updaterService.getHaveBeenUpdated()));
});
