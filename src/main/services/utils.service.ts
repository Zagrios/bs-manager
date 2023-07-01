import path from "path";
import { app, BrowserWindow } from "electron";
import { IpcResponse } from "shared/models/ipc";
import log from "electron-log";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import psList from "ps-list";


// TODO : REFACTOR

export class UtilsService{

  private static instance: UtilsService;

  private assetsPath: string = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(__dirname, '../../../assets');

  private windows: Map<AppWindow, BrowserWindow> = new Map<AppWindow, BrowserWindow>();

  private constructor(){}

  public static getInstance(){
    if(!this.instance){ UtilsService.instance = new UtilsService(); }
    return UtilsService.instance;
  }

  public setAssetsPath(path: string): void{ this.assetsPath = path; }
  public getAssetsPath(pathToFile: string): string{ return path.join(this.assetsPath, pathToFile); }

  public getAssetsScriptsPath(): string { return this.getAssetsPath("scripts") }
  public getAssestsJsonsPath(): string { return this.getAssetsPath("jsons"); }
  public getTempPath(): string{ return path.join(app.getPath("temp"), app.getName()) }

  public setMainWindows(windows: Map<AppWindow, BrowserWindow>){ this.windows = windows; }
  public getMainWindows(win: AppWindow){ return this.windows.get(win); }

    public async taskRunning(task: string): Promise<boolean> {
        try{
            const processes = await psList();
            return !!processes.find(process => process.cmd.includes(task));
        }
        catch(error){
            log.error(error);
            return null;
        }
    }

  public ipcSend<T = unknown>(channel: string, response: IpcResponse<T>): void{
    try {
        Array.from(this.windows.values()).forEach(window => window?.webContents?.send(channel, response));
    } catch (error) {
        log.error(error);
    }
  }



}
