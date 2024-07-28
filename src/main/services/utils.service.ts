import path from "path";
import { app, BrowserWindow } from "electron";
import { IpcResponse } from "shared/models/ipc";
import log from "electron-log";

// TODO : REFACTOR

export class UtilsService {
    private static instance: UtilsService;

    private assetsPath: string = app.isPackaged ? path.join(process.resourcesPath, "assets") : path.join(__dirname, "../../assets");

    private constructor() {}

    public static getInstance() {
        if (!this.instance) {
            UtilsService.instance = new UtilsService();
        }
        return UtilsService.instance;
    }

    public setAssetsPath(path: string): void {
        this.assetsPath = path;
    }
    public getAssetsPath(pathToFile: string): string {
        return path.join(this.assetsPath, pathToFile);
    }

    public getAssetsScriptsPath(): string {
        return this.getAssetsPath("scripts");
    }
    public getAssestsJsonsPath(): string {
        return this.getAssetsPath("jsons");
    }
    public getTempPath(): string {
        return path.join(app.getPath("temp"), app.getName());
    }

    public ipcSend<T = unknown>(channel: string, response: IpcResponse<T>): void {
        try {
            BrowserWindow.getAllWindows().forEach(window => window?.webContents?.send(channel, response));
        } catch (error) {
            log.error(error);
        }
    }
}
