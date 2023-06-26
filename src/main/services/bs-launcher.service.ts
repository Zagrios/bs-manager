import path from "path";
import { LaunchResult, LaunchOption, BSLaunchEvent, BSLaunchErrorEvent, BSLaunchErrorType, BSLaunchEventType } from "../../shared/models/bs-launch";
import { UtilsService } from "./utils.service";
import { BS_EXECUTABLE, BS_APP_ID, STEAMVR_APP_ID } from "../constants";
import { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio, spawn } from "child_process";
import { SteamService } from "./steam.service";
import { BSLocalVersionService } from "./bs-local-version.service";
import { OculusService } from "./oculus.service";
import { pathExist } from "../helpers/fs.helpers";
import { rename } from "fs/promises";
import log from "electron-log";
import { Observable, lastValueFrom, timer } from "rxjs";
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
    public async launch(launchOptions: LaunchOption): Promise<LaunchResult>{
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

    private buildBsLaunchArgs(launchOptions: LaunchOption){
        let launchArgs = [];

        if(!launchOptions.version.steam && !launchOptions.version.oculus){ launchArgs.push("--no-yeet"); }
        if(launchOptions.oculus){ launchArgs.push("-vrmode oculus"); }
        if(launchOptions.desktop){ launchArgs.push("fpfc"); }
        if(launchOptions.debug){ launchArgs.push("--verbose"); }
        if(launchOptions.additionalArgs){ launchArgs.push(...launchOptions.additionalArgs); }

        return Array.from(new Set(launchArgs).values());
    }

    private launchBSProcess(bsExePath: string, args: string[], debug = false): Promise<void>{

        if(this.bsProcess?.connected){
            return Promise.reject("Beat Saber process already running");
        }

        const spawnOptions: SpawnOptionsWithoutStdio = { shell: true, cwd: path.dirname(bsExePath), env: {...process.env, "SteamAppId": BS_APP_ID} };

        if(debug){
            spawnOptions.detached = true;
            spawnOptions.windowsVerbatimArguments = true;
        }

        this.bsProcess = spawn(`\"${bsExePath}\"`, args, spawnOptions);

        return new Promise((resolve, reject) => {
            this.bsProcess.on('error', e => { log.error(e); reject(e); });
            this.bsProcess.once('exit', code => {
                if(code !== 0){
                    log.error(`Beat Saber process exited with code ${code}`);
                }
                resolve();
            });
        });

    }

    public launchV2(launchOptions: LaunchOption): Observable<BSLaunchEvent>{
        return new Observable<BSLaunchEvent>(obs => {(async () => {

            if(this.isBsRunning()){
                return obs.error({type: BSLaunchErrorType.BS_ALREADY_RUNNING} as BSLaunchErrorEvent);
            }

            if(launchOptions.version.oculus && this.oculusService.oculusRunning() === false){
                return obs.error({type: BSLaunchErrorType.OCULUS_NOT_RUNNING} as BSLaunchErrorEvent);
            }

            const bsFolderPath = await this.localVersionService.getVersionPath(launchOptions.version);
            const exePath = path.join(bsFolderPath, BS_EXECUTABLE);

            if(!(await pathExist(exePath))){
                return obs.error({type: BSLaunchErrorType.BS_NOT_FOUND} as BSLaunchErrorEvent);
            }

            // Open Steam if not running
            if(!launchOptions.version.oculus && !(await this.steamService.steamRunning())){
                obs.next({type: BSLaunchEventType.STEAM_LAUNCHING});
                await this.steamService.openSteam().catch(log.error);
            }

            // Backup SteamVR when desktop mode is enabled
            if(!launchOptions.version.oculus && launchOptions.desktop){
                await this.backupSteamVR().catch(e => {
                    log.error("ERR_BACKUP_STEAM_VR", e);
                    this.restoreSteamVR();
                });
                await lastValueFrom(timer(2_000));
            } else if(!launchOptions.version.oculus){
                await this.restoreSteamVR();
            }

            const launchArgs = this.buildBsLaunchArgs(launchOptions);

            obs.next({type: BSLaunchEventType.BS_LAUNCHING});

            await this.launchBSProcess(exePath, launchArgs, launchOptions.debug).catch(() => {
                obs.error({type: BSLaunchErrorType.BS_EXIT_ERROR} as BSLaunchErrorEvent);
            }).finally(() => {
                if(!launchOptions.desktop || launchOptions.version.oculus){ return; }
                this.restoreSteamVR().catch(e => log.error("ERR_RESTORE_STEAM_VR", e)); 
            });

        })().then(() => {
            obs.complete()
        }).catch(err => {
            obs.error({type: BSLaunchErrorType.UNKNOWN_ERROR, data: err} as BSLaunchErrorEvent);
        })});
    }
     

}