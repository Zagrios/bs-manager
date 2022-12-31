import { existsSync, mkdirSync, readdirSync, readFile, rmSync } from "fs";
import { moveSync } from "fs-extra"
import { spawnSync } from "child_process";
import { homedir } from "os";
import path from "path";
import { app, BrowserWindow } from "electron";
import { rm, unlink } from "fs/promises";
import { IpcResponse } from "shared/models/ipc";
import log from "electron-log";
import { AppWindow } from "shared/models/window-manager/app-window.model";

// TODO : REFACTOR

export class UtilsService{

  private static instance: UtilsService;

  private assetsPath: string = '';

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

  public pathExist(path: string): boolean{ return existsSync(path); }

  public createFolderIfNotExist(path: string): void{
    if(!this.pathExist(path)){ mkdirSync(path, {recursive: true}); }
  }

  public async unlinkIfExist(pathToFile: string): Promise<void>{
    if(!this.pathExist(pathToFile)){ return }
    return unlink(pathToFile);
  }

  public async rmDirIfExist(path: string): Promise<void>{
    if(!this.pathExist(path)){ return; }
    return rm(path, {recursive: true, force: true});
  }

  public taskRunning(task: string): boolean{
    const tasks = spawnSync('tasklist').stdout.toString();
    return tasks.includes(task);
  }

  public getUserFolder(){ return homedir(); }

  public getUserDocumentsFolder(): string{
    return path.join(this.getUserFolder(), 'Documents');
  }

  public readFileAsync(path: string){
    return new Promise<Buffer>((resolve, reject) => {
      readFile(path, (err, data) => {
          if(err){ reject(err); }
          else{ resolve(data); }
      });
    });
  }

  public listDirsInDir(dirPath: string, fullPath = false): string[]{
    let files = readdirSync(dirPath, { withFileTypes:true});
    files = files.filter(f => f.isDirectory())
    return files.map(f => fullPath ? path.join(dirPath, f.name) : f.name);
  }

  public async deleteFolder(folderPath: string): Promise<void>{
    const folderExist = this.pathExist(folderPath);
    if(!folderExist){ return; }
    return rmSync(folderPath, {recursive: true});
  }

    public async moveDirContent(src: string, dest: string, overwrite = false): Promise<void>{
        const [srcExist, destExist] = await Promise.all([this.pathExist(src), this.pathExist(dest)]);
        if(!srcExist){ return; }
        if(!destExist){ await this.createFolderIfNotExist(dest); }
        readdirSync(src, {encoding: "utf-8"}).forEach(file => {
            const srcFullPath = path.join(src, file);
            const destFullPath = path.join(dest, file);
            if(!overwrite && this.pathExist(destFullPath)){ return; }
            moveSync(srcFullPath, destFullPath, {overwrite});
        });
    }

  public ipcSend<T = any>(channel: string, response: IpcResponse<T>): void{
    try {
        Array.from(this.windows.values()).forEach(window => window.webContents.send(channel, response));
    } catch (error) {
        log.error(error);
    }
  }



}
