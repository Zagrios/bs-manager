import { ipcMain } from "electron";
import { WindowManagerService } from "../services/window-manager.service";
import { IpcRequest } from "shared/models/ipc";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import { BSLauncherService } from "../services/bs-launcher.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";

const launcher = BSLauncherService.getInstance();
const ipc = IpcService.getInstance();

ipcMain.on("open-window-then-close-all", async (event, request: IpcRequest<AppWindow>) => {
    const windowManager = WindowManagerService.getInstance();

    windowManager.openWindow(request.args).then(window => {
        windowManager.closeAllWindows(request.args);
    });
});

ipcMain.on("close-all-windows", async (event, request: IpcRequest<AppWindow>) => {
    await launcher.restoreSteamVR();
    const windowManager = WindowManagerService.getInstance();
    windowManager.closeAllWindows(request.args);
});

ipcMain.on("close-windows", async (event, request: IpcRequest<AppWindow[]>) => {
    await launcher.restoreSteamVR();
    const windowManager = WindowManagerService.getInstance();
    windowManager.close(...request.args);
});

ipc.on<AppWindow>("open-window-or-focus", (req, reply) => {
    const windowManager = WindowManagerService.getInstance();
    reply(from(windowManager.openWindowOrFocus(req.args)));
});
