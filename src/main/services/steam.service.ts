import { UtilsService } from "./utils.service";
import regedit from 'regedit'
import path from "path";
import { parse } from "@node-steam/vdf";
import { readFile } from "fs/promises";
import { spawn } from "child_process";

export class SteamService{

  private static instance: SteamService;

  private readonly utils: UtilsService = UtilsService.getInstance();

  private steamPath: string = '';

  private constructor(){
    const vbsDirectory = path.join(this.utils.getAssetsScriptsPath(), "node-regedit", "vbs");
    regedit.setExternalVBSLocation(vbsDirectory);
  }

  public static getInstance(){
    if(!SteamService.instance){ SteamService.instance = new SteamService(); }
    return SteamService.instance;
  }

  public steamRunning(): boolean{
    return this.utils.taskRunning('steam.exe');
  }

  public async getSteamPath(): Promise<string>{

    if(!!this.steamPath){ return this.steamPath; }

    const [win32Res, win64Res] = await Promise.all([
      regedit.promisified.list(['HKLM\\SOFTWARE\\Valve\\Steam']),
      regedit.promisified.list(['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam'])
    ]);

    const [win32, win64] = [win32Res["HKLM\\SOFTWARE\\Valve\\Steam"], win64Res["HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam"]];
    
    let res = '';
    if(win64.exists && win64?.values?.InstallPath?.value){ res = win64.values.InstallPath.value as string; }
    else if(win32.exists && win32?.values?.InstallPath?.value){ res = win32.values.InstallPath.value as string; }
    this.steamPath = res;
    return this.steamPath;
  }

  public async getGameFolder(gameId: string, gameFolder?: string): Promise<string>{
    const steamPath = await this.getSteamPath();

    let libraryFolders: any = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');

    if(!this.utils.pathExist(libraryFolders)){ return null; }
    libraryFolders =  parse(await readFile(libraryFolders, {encoding: 'utf-8'}));

    if(!libraryFolders.libraryfolders){ return null; }
    libraryFolders = libraryFolders.libraryfolders

    for(const libKey in Object.keys(libraryFolders)){
      if(!libraryFolders[libKey] || !libraryFolders[libKey]["apps"]){ continue; }
      if(libraryFolders[libKey]["apps"][gameId]){ return path.join(libraryFolders[libKey]["path"], "steamapps", "common", gameFolder); };
    }
    return null;
  }

    public openSteam(): Promise<boolean>{
        const process = spawn("start", ["steam://open/games"], {shell: true});

        return new Promise(resolve => {
            process.on("exit", () => resolve(true));
            process.on("error", () => resolve(false));
        });
    }

}
