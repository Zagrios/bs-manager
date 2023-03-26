import { ipcMain } from "electron";
import { WindowManagerService } from "../services/window-manager.service";
import { IpcRequest } from "shared/models/ipc";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import { BSLauncherService } from "../services/bs-launcher.service";
import { ConfigurationService } from "../services/configuration.service";

const launcher = BSLauncherService.getInstance();
const configService = ConfigurationService.getInstance();
const HAVE_BEEN_UPDATED_KEY = "haveBeenUpdated";

ipcMain.on("open-window-then-close-all", async (event, request: IpcRequest<AppWindow>) => {
    const windowManager = WindowManagerService.getInstance();

    windowManager.openWindow(request.args).then(window => {
        windowManager.closeAllWindows(request.args);
    });
});

ipcMain.on("close-all-windows", async (event, request: IpcRequest<AppWindow>) => {
    configService.set(HAVE_BEEN_UPDATED_KEY, false);
    await launcher.restoreSteamVR();
    const windowManager = WindowManagerService.getInstance();
    windowManager.closeAllWindows(request.args);
});

ipcMain.on("close-windows", async (event, request: IpcRequest<AppWindow[]>) => {
    configService.set(HAVE_BEEN_UPDATED_KEY, false);    
    await launcher.restoreSteamVR();
    const windowManager = WindowManagerService.getInstance();
    windowManager.close(...request.args);
});