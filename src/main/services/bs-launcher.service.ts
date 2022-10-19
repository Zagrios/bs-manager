import path from "path";
import { LaunchResult, LauchOption } from "shared/models/bs-launch";
import { UtilsService } from "./utils.service";
import { BS_EXECUTABLE, BS_APP_ID } from "../constants";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { SteamService } from "./steam.service";
import { BSLocalVersionService } from "./bs-local-version.service";

export class BSLauncherService{

    private static instance: BSLauncherService;

    private readonly utilsService: UtilsService;
    private readonly steamService: SteamService;
    private readonly localVersionService: BSLocalVersionService;

    private bsProcess: ChildProcessWithoutNullStreams;

    public static getInstance(): BSLauncherService{
        if(!BSLauncherService.instance){ BSLauncherService.instance = new BSLauncherService(); }
        return BSLauncherService.instance;
    }

    private constructor(){
        this.utilsService = UtilsService.getInstance();
        this.steamService = SteamService.getInstance();
        this.localVersionService = BSLocalVersionService.getInstance();
    }

    public isBsRunning(): boolean{
        return this.bsProcess?.connected || this.utilsService.taskRunning(BS_EXECUTABLE);
    }

    public async launch(launchOptions: LauchOption): Promise<LaunchResult>{
        if(!this.steamService.steamRunning()){ return "STEAM_NOT_RUNNING" }
        if(this.isBsRunning()){ return "BS_ALREADY_RUNNING" }

        const cwd = await this.localVersionService.getVersionPath(launchOptions.version);
        const exePath = path.join(cwd, BS_EXECUTABLE);

        if(!this.utilsService.pathExist(exePath)){ return "EXE_NOT_FINDED"; }
        
        const launchMods = [launchOptions.oculus && "-vrmode oculus", launchOptions.desktop && "fpfc", launchOptions.debug && "--verbose"];

        this.bsProcess = spawn(`\"${exePath}\"`, launchMods, {shell: true, cwd: cwd, env: {...process.env, "SteamAppId": BS_APP_ID}});

        this.bsProcess.on('message', msg => { /** EMIT HERE **/ });
        this.bsProcess.on('error', err => { /** EMIT HERE **/ });
        this.bsProcess.on('exit', code => this.utilsService.ipcSend("bs-launch.exit", {data: code, success: code === 0}));

        return "LAUNCHED";
    }

}