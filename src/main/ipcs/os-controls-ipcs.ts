import { shell, dialog, app, BrowserWindow } from "electron";
import { NotificationService } from "../services/notification.service";
import { IpcService } from "../services/ipc.service";
import { from, of } from "rxjs";
import { readFileSync } from "fs-extra";

// TODO IMPROVE WINDOW CONTROL BY USING WINDOW SERVICE

const ipc = IpcService.getInstance();

ipc.on("new-window", (args, reply) => {
    reply(from(shell.openExternal(args)));
});

ipc.on("choose-folder", (args, reply) => {
    reply(from(dialog.showOpenDialog({ properties: ["openDirectory"], defaultPath: args ?? "" })));
});

ipc.on<string>("choose-file", async (args, reply) => {
    reply(from(dialog.showOpenDialog({ properties: ["openFile"], defaultPath: args ?? "" })));
});

ipc.on("window.progression",(args, reply, sender) => {
    BrowserWindow.fromWebContents(sender)?.setProgressBar(args / 100);
    reply(of(undefined));
});

ipc.on("save-file", (args, reply) => {
    reply(from(dialog.showSaveDialog({ properties: ["showOverwriteConfirmation"], defaultPath: args.filename, filters: args.filters }).then(res => {
        if (res.canceled || !res.filePath) {
            throw new Error("No file path selected");
        }
        return res.filePath;
    })));
});

ipc.on("current-version", (_, reply) => {
    reply(of(app.getVersion()));
});

ipc.on("open-logs", (_, reply) => {
    reply(from(shell.openPath(app.getPath("logs"))));
});

ipc.on("notify-system", (args, reply) => {
    const systemNotification = NotificationService.getInstance();
    reply(of(systemNotification.notify(args)));
});

ipc.on("view-path-in-explorer", (args, reply) => {
    reply(of(shell.showItemInFolder(args)));
});

ipc.on("choose-image", (args, reply) => {
    reply(from(dialog.showOpenDialog({ properties: ["openFile", "multiSelections"], filters: [{ name: "Images", extensions: ["jpg", "png", "jpeg"] }] }).then(res => {
        if (res.canceled || !res.filePaths) {
            return [];
        }
        if(args.base64){
            return res.filePaths.map(path => Buffer.from(readFileSync(path)).toString("base64"));
        }
        return res.filePaths;
    })));
});
