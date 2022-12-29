import { LauchOption, LaunchResult } from "shared/models/bs-launch";
import { BSVersion } from 'shared/bs-version.interface';
import { IpcService } from "./ipc.service";
import { NotificationResult, NotificationService } from "./notification.service";
import { BsDownloaderService } from "./bs-downloader.service";
import { BehaviorSubject } from "rxjs";

export class BSLauncherService{

    private static instance: BSLauncherService;

    private readonly ipcService: IpcService;
    private readonly notificationService: NotificationService;
    private readonly bsDownloaderService: BsDownloaderService;

    public readonly launchState$: BehaviorSubject<BSVersion> = new BehaviorSubject(null);
   
    public static getInstance(){
        if(!BSLauncherService.instance){ BSLauncherService.instance = new BSLauncherService(); }
        return BSLauncherService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.bsDownloaderService = BsDownloaderService.getInstance();
        this.listenBsExit();
    }

    private listenBsExit(): void{
        this.ipcService.watch("bs-launch.exit").subscribe(res => {
            const version = this.launchState$.value;
            this.launchState$.next(null);
            if(res.success){ return; }
            this.notificationService.notifyError({title: "notifications.bs-launch.errors.titles.EXIT", desc: "notifications.bs-launch.errors.msg.EXIT", actions: [{id: "0", title: "misc.verify"}]}).then(res => {
                if(res === "0"){ this.bsDownloaderService.download(version, true); }
            });
        });
    }



    public launch(version: BSVersion, oculus: boolean, desktop: boolean, debug: boolean): Promise<NotificationResult|string>{
        const lauchOption: LauchOption = {debug, oculus, desktop, version};
        if(this.launchState$.value){ return this.notificationService.notifyError({title: "notifications.bs-launch.errors.titles.BS_ALREADY_RUNNING"}); }
        this.launchState$.next(version);
        return this.ipcService.send<LaunchResult>("bs-launch.launch", {args: lauchOption}).then(res => {

            if(res.data === "LAUNCHED"){ return this.notificationService.notifySuccess({title: "notifications.bs-launch.success.titles.launching"}); }

            this.launchState$.next(null);
            if(!res.success){
                return this.notificationService.notifyError({title: "notifications.bs-launch.errors.titles.UNABLE_TO_LAUNCH", desc: res.error.title}); 
            }
            if(res.data === "EXE_NOT_FINDED"){
                return this.notificationService.notifyError({title: "notifications.bs-launch.errors.titles.EXE_NOT_FINDED", desc: "notifications.bs-launch.errors.msg.EXE_NOT_FINDED", actions: [{id: "0", title:"misc.verify"}]}).then(res => {
                    if(res === "0"){ this.bsDownloaderService.download(version, true); }
                    return res;
                });
            }
            if(res.data){
                // TODO : too much nesting here, need refactor
                if(res.data === "STEAM_NOT_RUNNING"){
                    return new Promise(async resolve => {
                        const notif = await this.notificationService.notifyError({title: `notifications.bs-launch.errors.titles.${res.data}`, actions: [{id: "0", title: `notifications.bs-launch.errors.actions.${res.data}`}]});
                        if(notif === "0"){
                            await this.ipcService.send<boolean>("open-steam");
                            const lastNotif = await this.notificationService.notifySuccess({title: "notifications.steam.steam-launching.title", desc: "notifications.steam.steam-launching.description"});
                            resolve(lastNotif);
                        }
                        resolve(notif)
                    })
                }
                return this.notificationService.notifyError({title: `notifications.bs-launch.errors.titles.${res.data}`}); 
            }
            return this.notificationService.notifyError({title: res.data || res.error.title});
      });
   }

}

export enum LaunchMods{
   OCULUS_MOD = "LAUNCH_OCULUS_MOD",
   DESKTOP_MOD = "LAUNCH_DESKTOP_MOD",
   DEBUG_MOD ="LAUNCH_DEBUG_MOD"
}
