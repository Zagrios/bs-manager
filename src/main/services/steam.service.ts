import { UtilsService } from "./utils.service";
import regedit from "regedit";
import path from "path";
import { parse } from "@node-steam/vdf";
import { readFile } from "fs/promises";
import { pathExist } from "../helpers/fs.helpers";
import log from "electron-log";
import { app, shell } from "electron";

export class SteamService {

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
        const steamProcessRunning = await this.utils.taskRunning("steam");
        if(process.platform === "linux") { return steamProcessRunning; }

        return steamProcessRunning && !!(await this.getActiveUser());
    }

    public async getSteamPath(): Promise<string>{

        if(this.steamPath){ return this.steamPath; }

        switch (process.platform) {
            case "linux":
                this.steamPath = path.join(app.getPath('home'), '.steam', "steam");
                return this.steamPath;
            case "win32":
                // eslint-disable-next-line no-case-declarations
                const [win32Res, win64Res] = await Promise.all([
                    regedit.promisified.list(['HKLM\\SOFTWARE\\Valve\\Steam']),
                    regedit.promisified.list(['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam'])
                ]);

                // eslint-disable-next-line no-case-declarations
                const [win32, win64] = [win32Res["HKLM\\SOFTWARE\\Valve\\Steam"], win64Res["HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam"]];

                if(win64.exists && win64?.values?.InstallPath?.value){ 
                    this.steamPath = win64.values.InstallPath.value as string;
                }
                else if (win32.exists && win32?.values?.InstallPath?.value){
                    this.steamPath = win32.values.InstallPath.value as string; 
                }

                return this.steamPath;
            default:
                return null;
        }
    }

    public async getGameFolder(gameId: string, gameFolder?: string): Promise<string> {
        try {
            const steamPath = await this.getSteamPath();

            let libraryFolders: any = path.join(steamPath, "steamapps", "libraryfolders.vdf");

            if (!(await pathExist(libraryFolders))) { return null; }
            
            libraryFolders = parse(await readFile(libraryFolders, { encoding: "utf-8" }));

            if (!libraryFolders.libraryfolders) { return null; }
            libraryFolders = libraryFolders.libraryfolders;

            for (const libKey in Object.keys(libraryFolders)) {
                if (!libraryFolders[libKey] || !libraryFolders[libKey].apps) { continue; }

                if (libraryFolders[libKey].apps[gameId] != null) {
                    return path.join(libraryFolders[libKey].path, "steamapps", "common", gameFolder);
                }
            }

            return null;
            
        } catch (e) {
            log.error(e);
            return null;
        }
    }

    public openSteam(): Promise<void> {
        shell.openPath("steam://open/games").catch(e => log.error(e));

        return new Promise(async (resolve, reject) => {
            // Every 3 seconds check if steam is running
            const interval = setInterval(async () => {
                const steamRunning = await this.steamRunning().catch(() => false);
                if (!steamRunning) {
                    return;
                }
                clearInterval(interval);
                resolve();
            }, 4000);

            // If steam is not running after 60 seconds, reject
            setTimeout(() => {
                clearInterval(interval);
                reject("Unable to open steam");
            }, 60_000);
        });
    }
}
