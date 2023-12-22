import { WindowManagerService } from "../services/window-manager.service";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";
import { BrowserWindow, ipcMain } from "electron";

const ipc = IpcService.getInstance();

// Native windows control, do not pass through IPC service
ipcMain.on("close-window", async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.on("maximise-window", async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.maximize();
});

ipcMain.on("minimise-window", async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on("unmaximise-window", async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.unmaximize();
});


ipc.on<AppWindow>("open-window-then-close-all", (req, reply) => {
    const windowManager = WindowManagerService.getInstance();

    const res = windowManager.openWindow(req.args).then(() => {
        windowManager.closeAllWindows(req.args);
    });

    reply(from(res));
});

ipc.on<AppWindow>("open-window-or-focus", (req, reply) => {
    const windowManager = WindowManagerService.getInstance();
    reply(from(windowManager.openWindowOrFocus(req.args)));
});
