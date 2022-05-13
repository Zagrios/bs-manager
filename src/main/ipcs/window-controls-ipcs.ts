import { ipcMain } from 'electron';
import { getMainWindow } from '../main';

ipcMain.on('window.close', () => {
  getMainWindow()?.close();
});

ipcMain.on('window.maximize', () => {
  getMainWindow()?.maximize();
});

ipcMain.on('window.minimize', () => {
  getMainWindow()?.minimize();
});

ipcMain.on('window.reset', () => {
  console.log('aaaaaa');
  getMainWindow()?.restore();
});
