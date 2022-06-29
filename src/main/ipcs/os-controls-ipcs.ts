import { ipcMain, shell, dialog } from 'electron';
import { UtilsService } from '../services/utils.service';
import { IpcRequest } from '../../shared/models/ipc-models.model';
import { getMainWindow } from '../main';
import { request } from 'http';

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

ipcMain.on('new-window', async (event, url: string) => {
  shell.openExternal(url);
});

ipcMain.on('choose-folder', async (event, request: IpcRequest<void>) => {
  dialog.showOpenDialog({properties: ['openDirectory']}).then(res => {
    UtilsService.getInstance().newIpcSenc(request.responceChannel, {success: true, data: res});
  })
})

ipcMain.on("window.progression", async (event, request: IpcRequest<number>) => {
  getMainWindow().setProgressBar(request.args / 100);
})
