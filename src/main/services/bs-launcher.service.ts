import path from "path";
import { LaunchOption, BSLaunchEvent, BSLaunchErrorEvent, BSLaunchErrorType, BSLaunchEventType } from "../../shared/models/bs-launch";
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
import { BsmProtocolService } from "./bsm-protocol.service";
import { URL } from "url";

export class BSLauncherService{

    private static instance: BSLauncherService;

    private readonly utilsService: UtilsService;
    private readonly steamService: SteamService;
    private readonly oculusService: OculusService;
    private readonly localVersionService: BSLocalVersionService;
    private readonly bsmProtocolService: BsmProtocolService;

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
        this.bsmProtocolService = BsmProtocolService.getInstance();

        this.bsmProtocolService.on("launch", link => {
            log.info("Launch from bsm protocol", link.toString());
            if(!link.searchParams.has("launchOptions")){ return; }
            this.launch(JSON.parse(link.searchParams.get("launchOptions"))).subscribe();
        });
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

    public async isBsRunning(): Promise<boolean> {
        return this.utilsService.taskRunning(BS_EXECUTABLE);
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

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEvent>{

        // const t = new URL("bsmanager://launch");
        // t.searchParams.set("launchOptions", JSON.stringify(launchOptions));
        // console.log(t.toString());

        return new Observable<BSLaunchEvent>(obs => {(async () => {

            if(await this.isBsRunning()){
                return obs.error({type: BSLaunchErrorType.BS_ALREADY_RUNNING} as BSLaunchErrorEvent);
            }

            if(launchOptions.version.oculus && (await this.oculusService.oculusRunning())){
                return obs.error({type: BSLaunchErrorType.OCULUS_NOT_RUNNING} as BSLaunchErrorEvent);
            }

            const bsFolderPath = await this.localVersionService.getInstalledVersionPath(launchOptions.version);
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
                    return this.restoreSteamVR();
                });
                await lastValueFrom(timer(2_000));
            } else if(!launchOptions.version.oculus){
                await this.restoreSteamVR();
            }

            const launchArgs = this.buildBsLaunchArgs(launchOptions);

            obs.next({type: BSLaunchEventType.BS_LAUNCHING});

            await this.launchBSProcess(exePath, launchArgs, launchOptions.debug).catch(err => {
                obs.error({type: BSLaunchErrorType.BS_EXIT_ERROR, data: err} as BSLaunchErrorEvent);
            }).finally(() => {
                if(!launchOptions.desktop || launchOptions.version.oculus){ return; }
                this.restoreSteamVR();
            });

        })().then(() => {
            obs.complete();
        }).catch(err => {
            obs.error({type: BSLaunchErrorType.UNKNOWN_ERROR, data: err} as BSLaunchErrorEvent);
        })});
    }
     

}
