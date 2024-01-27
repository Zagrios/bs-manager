import { RegDwordValue } from "regedit-rs"
import path from "path";
import { parse } from "@node-steam/vdf";
import { readFile } from "fs/promises";
import { pathExist } from "../helpers/fs.helpers";
import log from "electron-log";
import { app, shell } from "electron";
import { getProcessPid, taskRunning } from "../helpers/os.helpers";
import { isElevated } from "query-process";
import { execOnOs } from "../helpers/env.helpers";

const { list } = (execOnOs({ win32: () => require("regedit-rs") }, true) ?? {}) as typeof import("regedit-rs");

export class SteamService {

    private static readonly PROCESS_NAME = "steam";

    private static instance: SteamService;

    private steamPath: string = '';

    private constructor(){}

    public static getInstance(){
        if(!SteamService.instance){ SteamService.instance = new SteamService(); }
        return SteamService.instance;
    }

    public async getActiveUser(): Promise<number>{
        const res = await list("HKCU\\Software\\Valve\\Steam\\ActiveProcess");
        const key = res["HKCU\\Software\\Valve\\Steam\\ActiveProcess"];
        if(!key.exists){ throw new Error("Key \"HKCU\\Software\\Valve\\Steam\\ActiveProcess\" not exist"); }
        const registryValue = key.values.ActiveUser as RegDwordValue;
        if(!registryValue){ throw new Error("Value \"ActiveUser\" not exist"); }
        return registryValue.value;
    }

    public async steamRunning(): Promise<boolean>{
        const steamProcessRunning = await taskRunning(SteamService.PROCESS_NAME);
        if(process.platform === "linux") { return steamProcessRunning; }
        const activeUser = await this.getActiveUser().catch(err => log.error(err));
        return steamProcessRunning && !!activeUser;
    }

    public async getSteamPid(): Promise<number>{
        return getProcessPid(SteamService.PROCESS_NAME);
    }

    public async isElevated(): Promise<boolean>{
        if(process.platform === "linux"){ return true; }
        const steamPid = await this.getSteamPid();

        if(!steamPid){ return false; }

        return isElevated(steamPid);
    }

    public async getSteamPath(): Promise<string>{

        if(this.steamPath){ return this.steamPath; }

        switch (process.platform) {
            case "linux":
                this.steamPath = path.join(app.getPath('home'), '.steam', "steam");
                return this.steamPath;
            case "win32": {
                const res = await list(['HKLM\\SOFTWARE\\Valve\\Steam', 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam']);
                const win64 = res['HKLM\\SOFTWARE\\Valve\\Steam'];
                const win32 = res['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam'];

                if (win64.exists && win64?.values?.InstallPath?.value) {
                    this.steamPath = win64.values.InstallPath.value as string;
                } else if (win32.exists && win32?.values?.InstallPath?.value) {
                    this.steamPath = win32.values.InstallPath.value as string;
                }

                return this.steamPath;
            }
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
                if (!libraryFolders?.[libKey]?.apps) { continue; }

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

    public async openSteam(): Promise<void> {

        await shell.openPath("steam://open/games");

        return new Promise((resolve, reject) => {
            // Every 3 seconds check if steam is running
            const interval = setInterval(() => {
                const steamRunning = this.steamRunning().catch(() => false);
                steamRunning.then(running => {
                    if(!running){ return; }
                    clearInterval(interval);
                    resolve();
                });
            }, 4000);

            // If steam is not running after 60 seconds, reject
            setTimeout(() => {
                clearInterval(interval);
                reject("Unable to open steam");
            }, 60_000);
        });
    }
}
