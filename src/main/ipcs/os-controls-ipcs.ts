import { ipcMain, shell, dialog, app } from 'electron';
import { UtilsService } from '../services/utils.service';
import { IpcRequest } from 'shared/models/ipc';

ipcMain.on('window.close', async () => {
    const utils = UtilsService.getInstance();
    utils.getMainWindow()?.close();
});

ipcMain.on('window.maximize', async () => {
    const utils = UtilsService.getInstance();
    utils.getMainWindow()?.maximize();
});

ipcMain.on('window.minimize', async () => {
    const utils = UtilsService.getInstance();
    utils.getMainWindow()?.minimize();
});

ipcMain.on('window.reset', async () => {
    const utils = UtilsService.getInstance();
    utils.getMainWindow()?.restore();
});

ipcMain.on('new-window', async (event, request: IpcRequest<string>) => {
    shell.openExternal(request.args);
});

ipcMain.on('choose-folder', async (event, request: IpcRequest<void>) => {
  dialog.showOpenDialog({properties: ['openDirectory']}).then(res => {
    UtilsService.getInstance().ipcSend(request.responceChannel, {success: true, data: res});
  });
});

ipcMain.on("window.progression", async (event, request: IpcRequest<number>) => {
    const utils = UtilsService.getInstance();
    utils.getMainWindow().setProgressBar(request.args / 100);
});

ipcMain.on('save-file', async (event, request: IpcRequest<{filename?: string, filters?: Electron.FileFilter[]}>) => {
    dialog.showSaveDialog({properties: ['showOverwriteConfirmation'], defaultPath: request.args.filename, filters: request.args.filters}).then(res => {
        const utils = UtilsService.getInstance();
        if(res.canceled || !res.filePath){ utils.ipcSend(request.responceChannel, {success: false}); }
        UtilsService.getInstance().ipcSend(request.responceChannel, {success: true, data: res.filePath});
    })
});

ipcMain.on("current-version", async (event, request: IpcRequest<void>) => {
    UtilsService.getInstance().ipcSend(request.responceChannel, {success: true, data: app.getVersion()});
});

ipcMain.on("open-logs", async (event, request: IpcRequest<void>) => {
    shell.openPath(app.getPath("logs"));
});
