import { ipcMain, shell, dialog, app, BrowserWindow } from "electron";
import { UtilsService } from "../services/utils.service";
import { IpcRequest } from "shared/models/ipc";
import { SystemNotificationOptions } from "shared/models/notification/system-notification.model";
import { NotificationService } from "../services/notification.service";
import { SteamService } from "../services/steam.service";
import { IpcService } from "../services/ipc.service";
import { from, of } from "rxjs";

// TODO IMPROVE WINDOW CONTROL BY USING WINDOW SERVICE

const ipc = IpcService.getInstance();

ipcMain.on("new-window", async (event, request: IpcRequest<string>) => {
    shell.openExternal(request.args);
});

ipc.on<string>("choose-folder", async (req, reply) => {
    reply(from(dialog.showOpenDialog({ properties: ["openDirectory"], defaultPath: req.args ?? "" })));
});

ipcMain.on("window.progression", async (event, request: IpcRequest<number>) => {
    BrowserWindow.fromWebContents(event.sender)?.setProgressBar(request.args / 100);
});

ipcMain.on("save-file", async (event, request: IpcRequest<{ filename?: string; filters?: Electron.FileFilter[] }>) => {
    dialog.showSaveDialog({ properties: ["showOverwriteConfirmation"], defaultPath: request.args.filename, filters: request.args.filters }).then(res => {
        const utils = UtilsService.getInstance();
        if (res.canceled || !res.filePath) {
            utils.ipcSend(request.responceChannel, { success: false });
        }
        UtilsService.getInstance().ipcSend(request.responceChannel, { success: true, data: res.filePath });
    });
});

ipc.on("current-version", (_, reply) => {
    reply(of(app.getVersion()));
});

ipcMain.on("open-logs", async (event, request: IpcRequest<void>) => {
    shell.openPath(app.getPath("logs"));
});

ipcMain.on("notify-system", async (event, request: IpcRequest<SystemNotificationOptions>) => {
    NotificationService.getInstance().notify(request.args);
});

ipcMain.on("open-steam", async (event, request: IpcRequest<void>) => {
    const steam = SteamService.getInstance();
    const utils = UtilsService.getInstance();
    steam
        .openSteam()
        .then(res => {
            utils.ipcSend(request.responceChannel, { success: true, data: res });
        })
        .catch(e => {
            utils.ipcSend(request.responceChannel, { success: false, error: e });
        });
});
