import { existsSync, mkdirSync } from "fs";
import { spawnSync } from "child_process";
import { homedir } from "os";
import path from "path";

export class UtilsService{

  private static instance: UtilsService;

  private assetsPath: string = '';

  private constructor(){}

  public static getInstance(){
    if(!this.instance){ UtilsService.instance = new UtilsService(); }
    return UtilsService.instance;
  }

  public setAssetsPath(path: string): void{ this.assetsPath = path; }
  public getAssetsPath(): string{ return this.assetsPath; }

  //à supprimer
  public folderExist(path: string): boolean{ return existsSync(path); }

  public pathExist(path: string): boolean{ return existsSync(path); }

  public createFolderIfNotExist(path: string): void{
    if(!this.folderExist(path)){ mkdirSync(path); }
  }

  public taskRunning(task: string): boolean{
    const tasks = spawnSync('tasklist').stdout.toString();
    return tasks.includes(task);
  }

  public getUserFolder(){ return homedir(); }

  public getUserDocumentsFolder(): string{
    return path.join(this.getUserFolder(), 'Documents');
  }





}
