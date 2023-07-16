import { LaunchOption, BSLaunchEvent, BSLaunchWarning, BSLaunchEventData, BSLaunchErrorData, BSLaunchError } from "shared/models/bs-launch";
import { BSVersion } from 'shared/bs-version.interface';
import { IpcService } from "./ipc.service";
import { NotificationService } from "./notification.service";
import { BsDownloaderService } from "./bs-downloader.service";
import { BehaviorSubject, Observable, filter } from "rxjs";
import { ConfigurationService } from "./configuration.service";
import { ThemeService } from "./theme.service";

export class BSLauncherService {
    private static instance: BSLauncherService;

    private readonly ipcService: IpcService;
    private readonly notificationService: NotificationService;
    private readonly config: ConfigurationService;
    private readonly theme: ThemeService;

    public readonly versionRunning$: BehaviorSubject<BSVersion> = new BehaviorSubject(null);
   
    public static getInstance(){
        if(!BSLauncherService.instance){ BSLauncherService.instance = new BSLauncherService(); }
        return BSLauncherService.instance;
    }

    private constructor() {
        this.ipcService = IpcService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.config = ConfigurationService.getInstance();
        this.theme = ThemeService.getInstance();
    }

    public getLaunchOptions(version: BSVersion): LaunchOption{
        return {
            version,
            oculus: this.config.get(LaunchMods.OCULUS_MOD),
            desktop: this.config.get(LaunchMods.DESKTOP_MOD),
            debug: this.config.get(LaunchMods.DEBUG_MOD),
            additionalArgs: (this.config.get<string>("additionnal-args") || "").split(";").map(arg => arg.trim()).filter(arg => arg.length > 0)
        }
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

    public createLaunchShortcut(launchOptions: LaunchOption): Observable<void>{
        const options: LaunchOption = {...launchOptions, version: {...launchOptions.version, color: launchOptions.version.color || this.theme.getBsmColors()[1]}};
        return this.ipcService.sendV2<void, LaunchOption>("create-launch-shortcut", {args: options});
    }

}

export enum LaunchMods {
    OCULUS_MOD = "LAUNCH_OCULUS_MOD",
    DESKTOP_MOD = "LAUNCH_DESKTOP_MOD",
    DEBUG_MOD = "LAUNCH_DEBUG_MOD",
}
