import { UtilsService } from "./utils.service";
import regedit from 'regedit'
import path from "path";
import { parse } from "@node-steam/vdf";
import { readFile } from "fs/promises";

export class SteamService{

  private static instance: SteamService;

  private readonly utils: UtilsService = UtilsService.getInstance();

  private steamPath: string = '';

  private constructor(){}

  public static getInstance(){
    if(!SteamService.instance){ SteamService.instance = new SteamService(); }
    return SteamService.instance;
  }

  public steamRunning(): boolean{
    return this.utils.taskRunning('steam.exe');
  }

  public async getSteamPath(): Promise<string>{
    if(this.steamPath !== ''){ return this.steamPath; }
    const [win32Res, win64Res] = await Promise.all([
      regedit.promisified.list(['HKLM\\SOFTWARE\\Valve\\Steam']),
      regedit.promisified.list(['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam'])
    ]);
    const [win32, win64] = [win32Res["HKLM\\SOFTWARE\\Valve\\Steam"], win64Res["HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam"]];
    let res = ''
    if(win64.values.InstallPath.value){ res = win64.values.InstallPath.value as string; }
    else if(win32.values.InstallPath.value){ res = win32.values.InstallPath.value as string; }
    this.steamPath = res;
    return this.steamPath;
  }

  public async getSteamGamesFolder(): Promise<string>{
    this.isGameInstalled("");
    const steamFolder = await this.getSteamPath();
    return path.join(steamFolder, 'steamapps', 'common');
  }

  public async isGameInstalled(gameId: string): Promise<boolean>{
    const steamPath = await this.getSteamPath();
    let libraryFolders: any = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');

    if(!this.utils.pathExist(libraryFolders)){ return false; }
    libraryFolders =  parse(await readFile(libraryFolders, {encoding: 'utf-8'}));


    if(!libraryFolders.libraryfolders){ return false; }
    libraryFolders = libraryFolders.libraryfolders

    for(const libKey in Object.keys(libraryFolders)){
      if(!libraryFolders[libKey] || !libraryFolders[libKey]["apps"]){ continue; }
      if(libraryFolders[libKey]["apps"][gameId]){ return true };
    }
    return false;
  }

}
