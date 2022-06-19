import { existsSync, mkdirSync, readdirSync, readFile } from "fs";
import { spawnSync } from "child_process";
import { homedir } from "os";
import path from "path";
import { BrowserWindow } from "electron";
import { rm } from "fs/promises";

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
  public getAssetsPath(): string{ return this.assetsPath; }

  public setMainWindow(win: BrowserWindow){ this.mainWindow = win; }

  //à supprimer
  public folderExist(path: string): boolean{ return existsSync(path); }

  public pathExist(path: string): boolean{ return existsSync(path); }

  public createFolderIfNotExist(path: string): void{
    if(!this.folderExist(path)){ mkdirSync(path, {recursive: true}); }
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

  public listDirsInDir(dirPath: string): string[]{
    let files = readdirSync(dirPath, { withFileTypes:true});
    files = files.filter(f => f.isDirectory())
    return files.map(f => f.name);
  }

  public deleteFolder(folderPath: string): Promise<void>{
    return rm(folderPath, {recursive: true});
  }

  public ipcSend(channel: string, args?: any){
    this.mainWindow.webContents.send(channel, args);
  }

}
