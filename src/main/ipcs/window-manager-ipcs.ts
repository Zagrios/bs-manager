import { WindowManagerService } from "../services/window-manager.service";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import { BSLauncherService } from "../services/bs-launcher.service";
import { IpcService } from "../services/ipc.service";
import { from, of } from "rxjs";

const launcher = BSLauncherService.getInstance();
const ipc = IpcService.getInstance();

ipc.on<AppWindow>("open-window-then-close-all", (req, reply) => {
    const windowManager = WindowManagerService.getInstance();

    const res = windowManager.openWindow(req.args).then(() => {
        windowManager.closeAllWindows(req.args);
    });

    reply(from(res));
});

ipc.on<AppWindow>("close-all-windows", async (req, reply) => {
    await launcher.restoreSteamVR();
    const windowManager = WindowManagerService.getInstance();
    reply(of(windowManager.closeAllWindows(req.args)));
});

ipc.on<AppWindow[]>("close-windows", async (req, reply) => {
    await launcher.restoreSteamVR();
    const windowManager = WindowManagerService.getInstance();
    reply(of(windowManager.close(...req.args)));
});

ipc.on<AppWindow>("open-window-or-focus", (req, reply) => {
    const windowManager = WindowManagerService.getInstance();
    reply(from(windowManager.openWindowOrFocus(req.args)));
});
