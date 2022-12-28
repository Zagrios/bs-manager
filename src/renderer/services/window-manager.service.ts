import { AppWindow } from "shared/models/window-manager/app-window.model";
import { IpcService } from "./ipc.service";

export class WindowManagerService{

    private static instance: WindowManagerService;

    private readonly ipcService: IpcService;

    public static getInstance(): WindowManagerService{
        if(!WindowManagerService.instance){ WindowManagerService.instance = new WindowManagerService(); }
        return WindowManagerService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();
    }

    public openThenCloseAll(window: AppWindow){
        this.ipcService.sendLazy<AppWindow>("open-window-then-close-all", {args: window});
    }

    public closeAll(except?: AppWindow){
        this.ipcService.sendLazy<AppWindow>("close-all-windows", {args: except});
    }

    public close(...win: AppWindow[]){
        this.ipcService.sendLazy<AppWindow[]>("close-windows", {args: win});
    }

}