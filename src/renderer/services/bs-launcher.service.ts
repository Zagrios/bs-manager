import { LaunchOption, LaunchResult, BSLaunchEvent, BSLaunchWarning, BSLaunchEventData, BSLaunchErrorData, BSLaunchError } from "shared/models/bs-launch";
import { BSVersion } from 'shared/bs-version.interface';
import { IpcService } from "./ipc.service";
import { NotificationService } from "./notification.service";
import { BsDownloaderService } from "./bs-downloader.service";
import { BehaviorSubject, Observable, filter } from "rxjs";
import { NotificationResult } from "shared/models/notification/notification.model";

export class BSLauncherService {
    private static instance: BSLauncherService;

    private readonly ipcService: IpcService;
    private readonly notificationService: NotificationService;
    private readonly bsDownloaderService: BsDownloaderService;

    public readonly versionRunning$: BehaviorSubject<BSVersion> = new BehaviorSubject(null);
   
    public static getInstance(){
        if(!BSLauncherService.instance){ BSLauncherService.instance = new BSLauncherService(); }
        return BSLauncherService.instance;
    }

    private constructor() {
        this.ipcService = IpcService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.bsDownloaderService = BsDownloaderService.getInstance();
    }

    // TODO REMOVE
    private listenBsExit(): void{
        this.ipcService.watch("bs-launch.exit").subscribe(res => {
            const version = this.versionRunning$.value;
            this.versionRunning$.next(null);
            if(res.success){ return; }
            this.notificationService.notifyError({title: "notifications.bs-launch.errors.titles.EXIT", desc: "notifications.bs-launch.errors.msg.EXIT", actions: [{id: "0", title: "misc.verify"}]}).then(res => {
                if(res === "0"){ this.bsDownloaderService.download(version, true); }
            });
        });
    }

    // TODO : Rework with shortcuts implementation
    public launch_old(version: BSVersion, oculus: boolean, desktop: boolean, debug: boolean, additionalArgs?: string[]): Promise<NotificationResult|string>{
        const lauchOption: LaunchOption = {debug, oculus, desktop, version, additionalArgs};
        if(this.versionRunning$.value){ return this.notificationService.notifyError({title: "notifications.bs-launch.errors.titles.BS_ALREADY_RUNNING"}); }
        this.versionRunning$.next(version);
        return this.ipcService.send<LaunchResult>("bs-launch.launch", {args: lauchOption}).then(res => {

            if(res.data === "LAUNCHED"){ return this.notificationService.notifySuccess({title: "notifications.bs-launch.success.titles.launching"}); }

            this.versionRunning$.next(null);
            if(!res.success){
                return this.notificationService.notifyError({title: "notifications.bs-launch.errors.titles.UNABLE_TO_LAUNCH", desc: res.error.title}); 
            }
            if (res.data === "EXE_NOT_FINDED") {
                return this.notificationService.notifyError({ title: "notifications.bs-launch.errors.titles.EXE_NOT_FINDED", desc: "notifications.bs-launch.errors.msg.EXE_NOT_FINDED", actions: [{ id: "0", title: "misc.verify" }] }).then(res => {
                    if (res === "0") {
                        this.bsDownloaderService.download(version, true);
                    }
                    return res;
                });
            }
            if (res.data) {
                return this.notificationService.notifyError({ title: `notifications.bs-launch.errors.titles.${res.data}` });
            }
            return this.notificationService.notifyError({title: res.data || res.error.title});
      });
   }

    public doLaunch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{
        return this.ipcService.sendV2<BSLaunchEventData, LaunchOption>("bs-launch.launch", {args: launchOptions});
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData> {
        const launchState$ = this.doLaunch(launchOptions);

        this.versionRunning$.next(launchOptions.version);

        launchState$.pipe(filter(event => {
            const eventToFilter = [...Object.values(BSLaunchWarning), BSLaunchEvent.STEAM_LAUNCHED]
            return !eventToFilter.includes(event.type);
        })).subscribe({
            next: event => {
                this.notificationService.notifySuccess({title: `notifications.bs-launch.success.titles.${event.type}`, desc: `notifications.bs-launch.success.msg.${event.type}`});
            },
            error: (err: BSLaunchErrorData) => {
                if(!Object.values(BSLaunchError).includes(err.type)){
                    this.notificationService.notifyError({title: "notifications.bs-launch.errors.titles.UNKNOWN_ERROR", desc: "notifications.bs-launch.errors.msg.UNKNOWN_ERROR"});
                } else {
                    this.notificationService.notifyError({title: `notifications.bs-launch.errors.titles.${err.type}`, desc: `notifications.bs-launch.errors.msg.${err.type}`})
                }
            }
        }).add(() => {
            this.versionRunning$.next(null);
        });

        return launchState$;
    }

}

export enum LaunchMods {
    OCULUS_MOD = "LAUNCH_OCULUS_MOD",
    DESKTOP_MOD = "LAUNCH_DESKTOP_MOD",
    DEBUG_MOD = "LAUNCH_DEBUG_MOD",
}
