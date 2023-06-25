import path from "path";
import { LaunchResult, LauchOption } from "shared/models/bs-launch";
import { UtilsService } from "./utils.service";
import { BS_EXECUTABLE, BS_APP_ID, STEAMVR_APP_ID } from "../constants";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { SteamService } from "./steam.service";
import { BSLocalVersionService } from "./bs-local-version.service";
import { OculusService } from "./oculus.service";
import { pathExist } from "../helpers/fs.helpers";
import { rename } from "fs/promises";
import log from "electron-log";
import { timer } from "rxjs";
import { NotificationService } from "./notification.service";
import { NotificationType } from "../../shared/models/notification/notification.model";

export class BSLauncherService{

    private static instance: BSLauncherService;

    private readonly utilsService: UtilsService;
    private readonly steamService: SteamService;
    private readonly oculusService: OculusService;
    private readonly localVersionService: BSLocalVersionService;
    private readonly notification: NotificationService;

    private bsProcess: ChildProcessWithoutNullStreams;

    public static getInstance(): BSLauncherService{
        if(!BSLauncherService.instance){ BSLauncherService.instance = new BSLauncherService(); }
        return BSLauncherService.instance;
    }

    private constructor(){
        this.utilsService = UtilsService.getInstance();
        this.steamService = SteamService.getInstance();
        this.oculusService = OculusService.getInstance();
        this.localVersionService = BSLocalVersionService.getInstance();
        this.notification = NotificationService.getInstance();
    }

    private getSteamVRPath(): Promise<string>{
        return this.steamService.getGameFolder(STEAMVR_APP_ID, "SteamVR");
    }

    private async backupSteamVR(): Promise<void>{
        const steamVrFolder = await this.getSteamVRPath();
        if(!await pathExist(steamVrFolder)){ return; }
        return rename(steamVrFolder, steamVrFolder + ".bak").catch(log.error);
    }

    public async restoreSteamVR(): Promise<void>{
        const steamVrFolder = await this.getSteamVRPath();
        const steamVrBackup = steamVrFolder + ".bak";
        if(!await pathExist(steamVrBackup)){ return; }
        return rename(steamVrFolder + ".bak", steamVrFolder).catch(log.error);
    }

    public isBsRunning(): boolean{
        return this.bsProcess?.connected || this.utilsService.taskRunning(BS_EXECUTABLE) === true;
    }

    // TODO : Rework with shortcuts implementation
    public async launch(launchOptions: LauchOption): Promise<LaunchResult>{
        if(this.isBsRunning() === true){ return "BS_ALREADY_RUNNING" }
        if(launchOptions.version.oculus && this.oculusService.oculusRunning() === false){ return "OCULUS_NOT_RUNNING" }

        const steamRunning = await this.steamService.steamRunning().catch(() => true); // True if error (error not not means that steam is not running)
        if(!launchOptions.version.oculus && !steamRunning){
            
            this.notification.notifyRenderer({
                title: "notifications.steam.steam-launching.title",
                desc: "notifications.steam.steam-launching.description",
                type: NotificationType.SUCCESS,
            });

            await this.steamService.openSteam().catch(log.error);
        }

        const cwd = await this.localVersionService.getVersionPath(launchOptions.version);
        const exePath = path.join(cwd, BS_EXECUTABLE);

        if(!(await pathExist(exePath))){ return "EXE_NOT_FINDED"; }
        
        let launchArgs = [];

        if(!launchOptions.version.steam && !launchOptions.version.oculus){ launchArgs.push("--no-yeet"); }
        if(launchOptions.oculus){ launchArgs.push("-vrmode oculus"); }
        if(launchOptions.desktop){ launchArgs.push("fpfc"); }
        if(launchOptions.debug){ launchArgs.push("--verbose"); }
        if(launchOptions.additionalArgs){ launchArgs.push(...launchOptions.additionalArgs); }

        launchArgs = Array.from(new Set(launchArgs).values());

        let restoreTimout: NodeJS.Timeout;

        if(launchArgs.includes("fpfc")){
            await this.backupSteamVR().catch(() => {
                this.restoreSteamVR();
            }).finally(() => {
                restoreTimout = setTimeout(() => this.restoreSteamVR(), 35_000);
            });
            await timer(2_000).toPromise();
        }
        else{
            await this.restoreSteamVR();
        }

        if(launchOptions.debug){
            this.bsProcess = spawn(`\"${exePath}\"`, launchArgs, {shell: true, cwd, env: {...process.env, "SteamAppId": BS_APP_ID}, detached: true, windowsVerbatimArguments: true });
        }
        else{
            this.bsProcess = spawn(`\"${exePath}\"`, launchArgs, {shell: true, cwd, env: {...process.env, "SteamAppId": BS_APP_ID} });
        }

        this.bsProcess.on('error', err => log.error(err));
        this.bsProcess.on('exit', code => {
            this.restoreSteamVR().finally(() => clearTimeout(restoreTimout));
            this.utilsService.ipcSend("bs-launch.exit", {data: code, success: code === 0})
        });

        return "LAUNCHED";
    }

}