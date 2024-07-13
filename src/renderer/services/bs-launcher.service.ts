import { LaunchOption, BSLaunchEvent, BSLaunchWarning, BSLaunchEventData, BSLaunchError } from "shared/models/bs-launch";
import { BSVersion } from 'shared/bs-version.interface';
import { IpcService } from "./ipc.service";
import { NotificationService } from "./notification.service";
import { BehaviorSubject, Observable, lastValueFrom, tap } from "rxjs";
import { ConfigurationService } from "./configuration.service";
import { ThemeService } from "./theme.service";
import { BsStore } from "shared/models/bs-store.enum";
import { ModalExitCode, ModalService } from "./modale.service";
import { OriginalOculusVersionBackupModal } from "renderer/components/modal/modal-types/original-oculus-version-backup.modal";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { sToMs } from "shared/helpers/time.helpers";
import { NeedLaunchAdminModal } from "renderer/components/modal/modal-types/need-launch-admin-modal.component";

export class BSLauncherService {
    private static instance: BSLauncherService;

    private readonly ipcService: IpcService;
    private readonly notificationService: NotificationService;
    private readonly config: ConfigurationService;
    private readonly theme: ThemeService;
    private readonly modals: ModalService;

    public readonly versionRunning$: BehaviorSubject<BSVersion> = new BehaviorSubject(null);

    private readonly PROTON_PATH_KEY = "protonPath";

    public static getInstance(){
        if(!BSLauncherService.instance){ BSLauncherService.instance = new BSLauncherService(); }
        return BSLauncherService.instance;
    }

    private constructor() {
        this.ipcService = IpcService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.config = ConfigurationService.getInstance();
        this.theme = ThemeService.getInstance();
        this.modals = ModalService.getInstance();
    }

    public setProtonPath(protonPath: string|undefined): void {
        this.config.set(this.PROTON_PATH_KEY, protonPath);
    }

    public getProtonPath(): string|undefined {
        return this.config.get<string>(this.PROTON_PATH_KEY);
    }

    private notRewindBackupOculus(): boolean{
        return this.config.get<boolean>("not-rewind-backup-oculus");
    }

    private setNotRewindBackupOculus(value: boolean): void{
        this.config.set("not-rewind-backup-oculus", value);
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

    private handleLaunchEvents(events$: Observable<BSLaunchEventData>): Observable<BSLaunchEventData>{
        const eventToFilter = [...Object.values(BSLaunchWarning), BSLaunchEvent.STEAM_LAUNCHED]

        return events$.pipe(tap({
            next: event => {
                if(eventToFilter.includes(event.type)){ return; }
                this.notificationService.notifySuccess({title: `notifications.bs-launch.success.titles.${event.type}`, desc: `notifications.bs-launch.success.msg.${event.type}`});
            },
            error: (err: CustomError) => {
                if(!err?.code || !Object.values(BSLaunchError).includes(err.code as BSLaunchError)){
                    this.notificationService.notifyError({title: "notifications.bs-launch.errors.titles.UNKNOWN_ERROR", desc: "notifications.bs-launch.errors.msg.UNKNOWN_ERROR"});
                } else {
                    this.notificationService.notifyError({title: `notifications.bs-launch.errors.titles.${err.code}`, desc: `notifications.bs-launch.errors.msg.${err.code}`, duration: sToMs(9)})
                }
            }
        }))
    }

    private async doMustStartAsAdmin(): Promise<boolean> {
        const needAdmin = await lastValueFrom(this.ipcService.sendV2("bs-launch.need-start-as-admin"));
        if(!needAdmin){ return false; }
        if(this.config.get("dont-remind-admin")){ return true; }
        const modalRes = await this.modals.openModal(NeedLaunchAdminModal);
        if(modalRes.exitCode !== ModalExitCode.COMPLETED){ throw new Error("Admin launch canceled"); }
        this.config.set("dont-remind-admin", modalRes.data);
        return true;
    }

    public doLaunch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{
        launchOptions.protonPath = this.getProtonPath();
        return this.ipcService.sendV2("bs-launch.launch", launchOptions);
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData> {

        return new Observable<BSLaunchEventData>(obs => {
            (async () => {

                if(launchOptions.version.metadata?.store === BsStore.OCULUS && !this.notRewindBackupOculus()){
                    const { exitCode, data: notRewind } = await this.modals.openModal(OriginalOculusVersionBackupModal);
                    if(exitCode !== ModalExitCode.COMPLETED){ return; }
                    this.setNotRewindBackupOculus(notRewind);
                }

                if(launchOptions.version.metadata?.store !== BsStore.OCULUS){
                    launchOptions.admin = await this.doMustStartAsAdmin();
                }

                const launch$ = this.handleLaunchEvents(this.doLaunch(launchOptions));

                await lastValueFrom(launch$);

            })().then(() => {
                obs.complete();
            }).catch(err => {
                obs.error(err);
            })
        });

    }

    public createLaunchShortcut(launchOptions: LaunchOption): Observable<boolean>{
        const options: LaunchOption = {...launchOptions, version: {...launchOptions.version, color: launchOptions.version.color || this.theme.getBsmColors()[1]}};
        return this.ipcService.sendV2("create-launch-shortcut", options);
    }

    public restoreSteamVR(): Promise<void>{
        return lastValueFrom(this.ipcService.sendV2("bs-launch.restore-steamvr"));
    }
}

export enum LaunchMods {
    OCULUS_MOD = "LAUNCH_OCULUS_MOD",
    DESKTOP_MOD = "LAUNCH_DESKTOP_MOD",
    DEBUG_MOD = "LAUNCH_DEBUG_MOD",
}
