import { existsSync, mkdirSync, readdirSync, readFile, unlinkSync } from "fs";
import { spawnSync } from "child_process";
import { homedir } from "os";
import path from "path";
import { app, BrowserWindow } from "electron";
import { rm, unlink } from "fs/promises";
import { IpcResponse } from "shared/models/ipc";
import log from "electron-log";

export class UtilsService{

  private static instance: UtilsService;

  private assetsPath: string = '';

  private mainWindow: BrowserWindow;

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

  public setMainWindow(win: BrowserWindow){ this.mainWindow = win; }
  public getMainWindow(){ return this.mainWindow; }

  public pathExist(path: string): boolean{ return existsSync(path); }

  public createFolderIfNotExist(path: string): void{
    if(!this.pathExist(path)){ mkdirSync(path, {recursive: true}); }
  }

  public async unlinkIfExist(pathToFile: string): Promise<void>{
    if(!this.pathExist(pathToFile)){ return }
    return unlink(pathToFile);
  }

  public rmDirIfExist(path: string): Promise<void>{
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

  public deleteFolder(folderPath: string): Promise<void>{
    return rm(folderPath, {recursive: true});
  }

  public ipcSend<T = any>(channel: string, response: IpcResponse<T>): void{
    try {
        this.mainWindow.webContents.send(channel, response);
    } catch (error) {
        log.error(error);
    }
  }



}
