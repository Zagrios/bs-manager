import { ipcMain, shell, dialog } from 'electron';
import { UtilsService } from '../services/utils.service';
import { IpcRequest } from 'shared/models/ipc';
import { getMainWindow } from '../main';

ipcMain.on('window.close', async () => {
  getMainWindow()?.close();
});

ipcMain.on('window.maximize', async () => {
  getMainWindow()?.maximize();
});

ipcMain.on('window.minimize', async () => {
  getMainWindow()?.minimize();
});

ipcMain.on('window.reset', async () => {
  getMainWindow()?.restore();
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
  getMainWindow().setProgressBar(request.args / 100);
});
