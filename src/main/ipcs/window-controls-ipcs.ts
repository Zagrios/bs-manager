import { ipcMain } from 'electron';
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
