import { LauchOption } from "../../shared/models/launch-models.model";
import { BSVersion } from "../../main/services/bs-version-manager.service";
import { IpcService } from "./ipc.service";
import { BsLaunchResult } from "../../shared/models/launch-models.model";
import { IpcResponse } from "shared/models/ipc-models.model";

export class BSLauncherService{

    private static instance: BSLauncherService;

    private readonly ipcService: IpcService;

    public static getInstance(){
        if(!BSLauncherService.instance){ BSLauncherService.instance = new BSLauncherService(); }
        return BSLauncherService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();
    }

    public launch(version: BSVersion, oculus: boolean, desktop: boolean, debug: boolean): Promise<IpcResponse<BsLaunchResult>>{
        const lauchOption: LauchOption = {debug, oculus, desktop, version};
        return this.ipcService.send<BsLaunchResult>("bs-launch.launch", {args: lauchOption});
    }

}

export enum LaunchMods{
    OCULUS_MOD = "LAUNCH_OCULUS_MOD",
    DESKTOP_MOD = "LAUNCH_DESKTOP_MOD",
    DEBUG_MOD ="LAUNCH_DEBUG_MOD"
}
