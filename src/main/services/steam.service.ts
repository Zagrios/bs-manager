import { UtilsService } from "./utils.service";
import regedit from 'regedit'
import path from "path";
import { parse } from "@node-steam/vdf";
import { readFile } from "fs/promises";
import { spawn } from "child_process";
import { pathExist } from "../helpers/fs.helpers";
import log from "electron-log";
import psList from 'ps-list';

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

  public async getActiveUser(): Promise<number>{
    const res = await regedit.promisified.list(["HKCU\\Software\\Valve\\Steam\\ActiveProcess"]);
    const keys = res?.["HKCU\\Software\\Valve\\Steam\\ActiveProcess"];
    if(!keys?.exists){ throw "Key \"HKCU\\Software\\Valve\\Steam\\ActiveProcess\" not exist"; }
    return (keys.values?.ActiveUser.value || undefined) as number;
  }

  public async steamRunning(): Promise<boolean>{
    if (process.platform === 'win32') {
      return !!(await this.getActiveUser());
    }
    return await psList()
      .then(processes => !!processes.find(process => process.cmd.includes('steam')))
      .catch(e => {log.error(e); throw e})
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
    try{
        const steamPath = await this.getSteamPath();

        let libraryFolders: any = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');

        if(!(await pathExist(libraryFolders))){ return null; }
        libraryFolders =  parse(await readFile(libraryFolders, {encoding: 'utf-8'}));

        if(!libraryFolders.libraryfolders){ return null; }
        libraryFolders = libraryFolders.libraryfolders

        for(const libKey in Object.keys(libraryFolders)){
            if(!libraryFolders[libKey] || !libraryFolders[libKey]["apps"]){ continue; }
            if(libraryFolders[libKey]["apps"][gameId] != null){ return path.join(libraryFolders[libKey]["path"], "steamapps", "common", gameFolder); };
        }
        return null;
    }
    catch(e){
        log.error(e);
        return null;
    }
  }

    public openSteam(): Promise<void>{
        const process = spawn("start", ["steam://open/games"], {shell: true});

        process.on("error", log.error);
    
        return new Promise(async (resolve, reject) => {
            // Every 3 seconds check if steam is running
            const interval = setInterval(async () => {
                const steamRunning = await this.steamRunning().catch(() => false);
                if(!steamRunning){ return; }
                clearInterval(interval);
                resolve();
            }, 3000);

            // If steam is not running after 60 seconds, reject
            setTimeout(() => {
                clearInterval(interval);
                reject("Unable to open steam");
            }, 60_000);
        });
    }

}
