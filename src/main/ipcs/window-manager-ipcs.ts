import { WindowManagerService } from "../services/window-manager.service";
import { IpcService } from "../services/ipc.service";
import { from, of } from "rxjs";
import { BrowserWindow } from "electron";

const ipc = IpcService.getInstance();

// Native windows control, do not pass through IPC service
ipc.on("close-window", (_, reply, sender) => {
    reply(of(BrowserWindow.fromWebContents(sender)?.close()));
});

ipc.on("maximise-window", (_, reply, sender) => {
    reply(of(BrowserWindow.fromWebContents(sender)?.maximize()));
});

ipc.on("minimise-window", (_, reply, sender) => {
    reply(of(BrowserWindow.fromWebContents(sender)?.minimize()));
});

ipc.on("unmaximise-window", (_, reply, sender) => {
    reply(of(BrowserWindow.fromWebContents(sender)?.unmaximize()));
});


ipc.on("open-window-then-close-all", (args, reply) => {
    const windowManager = WindowManagerService.getInstance();

    const res = windowManager.openWindow(args).then(() => {
        windowManager.closeAllWindows(args);
    });

    reply(from(res));
});

ipc.on("open-window-or-focus", (args, reply) => {
    const windowManager = WindowManagerService.getInstance();
    reply(from(windowManager.openWindowOrFocus(args)));
});
