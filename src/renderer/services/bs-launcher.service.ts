import { LauchOption } from "../../main/ipcs/bs-launcher-ipcs";
import { BSVersion } from "../../main/services/bs-version-manager.service";

export class BSLauncherService{

    private static instance: BSLauncherService;

    public static getInstance(){
        if(!BSLauncherService.instance){ BSLauncherService.instance = new BSLauncherService(); }
        return BSLauncherService.instance;
    }

    private constructor(){}

    public launch(version: BSVersion, oculus: boolean, desktop: boolean, debug: boolean): Promise<any>{
        return new Promise((resolve, reject) => {

            window.electron.ipcRenderer.on('bs-launch.launch', res => {
                resolve(res);
            });
            const lauchOption: LauchOption = {debug, oculus, desktop, version: version}
            window.electron.ipcRenderer.sendMessage('bs-launch.launch', lauchOption);
        })
    }

}

export enum LaunchResult {
    LAUNCHED = 0,
    STEAM_NOT_RUNNING = 1,
    EXE_NOT_FIND = 2,
}

export enum LaunchMods{
    OCULUS_MOD = "LAUNCH_OCULUS_MOD",
    DESKTOP_MOD = "LAUNCH_DESKTOP_MOD",
    DEBUG_MOD ="LAUNCH_DEBUG_MOD"
}
