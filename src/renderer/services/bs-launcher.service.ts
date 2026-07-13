import { LaunchOption, BSLaunchEvent, BSLaunchWarning, BSLaunchEventData, BSLaunchError } from "shared/models/bs-launch";
import { BSVersion } from 'shared/bs-version.interface';
import { IpcService } from "./ipc.service";
import { NotificationService } from "./notification.service";
import { BehaviorSubject, EMPTY, Observable, defer, finalize, from, lastValueFrom, of, switchMap, tap, throwError } from "rxjs";
import { ConfigurationService } from "./configuration.service";
import { ThemeService } from "./theme.service";
import { BsStore } from "shared/models/bs-store.enum";
import { ModalExitCode, ModalService } from "./modale.service";
import { EnableOculusSideloadedApps } from "renderer/components/modal/modal-types/enable-oculus-sideloaded-apps";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { sToMs } from "shared/helpers/time.helpers";
import { NeedLaunchAdminModal } from "renderer/components/modal/modal-types/need-launch-admin-modal.component";
import { VrRuntimeMismatchModal } from "renderer/components/modal/modal-types/vr-runtime-mismatch-modal.component";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { VrRuntime, VR_RUNTIME_WARNING_DISMISS_KEY } from "shared/models/vr-runtime.model";
import { safeLt } from "shared/helpers/semver.helpers";

export class BSLauncherService {
    private static instance: BSLauncherService;

    private readonly ipcService: IpcService;
    private readonly notificationService: NotificationService;
    private readonly config: ConfigurationService;
    private readonly theme: ThemeService;
    private readonly modals: ModalService;
    private launchInProgress = false;

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
        this.modals = ModalService.getInstance();
    }

    public getLaunchOptions(version: BSVersion): LaunchOption {
        return {
            version,
            launchMods: this.config.get("launch-mods") ?? [],
            command: this.config.get<string>("launch-command") || "",
        }
    }

    private handleLaunchEvents(events$: Observable<BSLaunchEventData>): Observable<BSLaunchEventData>{
        const warningTypes: string[] = Object.values(BSLaunchWarning);

        return events$.pipe(tap({
            next: event => {
                if(warningTypes.includes(event.type)){
                    this.notificationService.notifyWarning({title: `notifications.bs-launch.warnings.titles.${event.type}`, desc: `notifications.bs-launch.warnings.msg.${event.type}`, duration: sToMs(9)});
                    return;
                }
                if(event.type === BSLaunchEvent.STEAM_LAUNCHED){ return; }
                this.notificationService.notifySuccess({title: `notifications.bs-launch.success.titles.${event.type}`, desc: `notifications.bs-launch.success.msg.${event.type}`});
            },
            error: (err: CustomError) => {
                if (err?.code?.startsWith("generic.")) {
                    this.notificationService.notifyError({
                        title: "notifications.bs-launch.errors.titles.UNKNOWN_ERROR",
                        desc: err.code,
                    });
                } else if(!err?.code || !Object.values(BSLaunchError).includes(err.code as BSLaunchError)){
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

    private async enableSideloadedAppsIfNeeded(): Promise<void> {
        if(window.electron.platform !== "win32"){ return; }
        const isSideloadedAppsEnabled = await lastValueFrom(this.ipcService.sendV2("is-oculus-sideloaded-apps-enabled"));
        if(isSideloadedAppsEnabled){ return; }

        const modalRes = await this.modals.openModal(EnableOculusSideloadedApps);

        if(modalRes.exitCode !== ModalExitCode.COMPLETED){
            throw new Error("Enable sideloaded apps canceled");
        }

        await lastValueFrom(this.ipcService.sendV2("enable-oculus-sideloaded-apps"));
    }

    private async confirmVrRuntime(launchOptions: LaunchOption): Promise<boolean> {
        const bypassesOpenXr = [LaunchMods.OCULUS, LaunchMods.FPFC, LaunchMods.EDITOR]
            .some(launchMod => launchOptions.launchMods?.includes(launchMod));
        const predatesOpenXr = safeLt(launchOptions.version.BSVersion, "1.29.4");

        if (window.electron.platform !== "win32" || bypassesOpenXr || predatesOpenXr || this.config.get(VR_RUNTIME_WARNING_DISMISS_KEY)) {
            return true;
        }

        const activeRuntime = await lastValueFrom(this.ipcService.sendV2("vr-runtime.get-active", launchOptions.command))
            .catch(() => VrRuntime.UNKNOWN);
        if (![VrRuntime.NOT_SET, VrRuntime.UNKNOWN].includes(activeRuntime)) {
            return true;
        }

        const modalRes = await this.modals.openModal(VrRuntimeMismatchModal, { data: activeRuntime });
        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return false;
        }

        if (modalRes.data) {
            this.config.set(VR_RUNTIME_WARNING_DISMISS_KEY, true);
        }

        return true;
    }

    private sendLaunch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{
        return this.ipcService.sendV2("bs-launch.launch", launchOptions);
    }

    private withLaunchState(launchOptions: LaunchOption, launchFactory: () => Observable<BSLaunchEventData>): Observable<BSLaunchEventData> {
        return defer(() => {
            if (this.launchInProgress) {
                return throwError(() => new Error("Beat Saber launch already in progress"));
            }

            this.launchInProgress = true;
            this.versionRunning$.next(launchOptions.version);

            return launchFactory().pipe(finalize(() => {
                this.launchInProgress = false;
                this.versionRunning$.next(null);
            }));
        });
    }

    public doLaunch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{
        return this.withLaunchState(launchOptions, () => from(this.confirmVrRuntime(launchOptions))
            .pipe(switchMap(shouldLaunch => shouldLaunch ? this.sendLaunch(launchOptions) : EMPTY)));
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData> {
        return this.withLaunchState(launchOptions, () => from(this.confirmVrRuntime(launchOptions)).pipe(
            switchMap(shouldLaunch => {
                if (!shouldLaunch) {
                    return EMPTY;
                }

                // If downgraded from oculus and its not the official version
                if(launchOptions.version.metadata?.store === BsStore.OCULUS && !launchOptions.version.oculus){
                    return from(this.enableSideloadedAppsIfNeeded());
                }

                return of(undefined);
            }),
            switchMap(() => {
                if(launchOptions.version.metadata?.store === BsStore.OCULUS){
                    return of(undefined);
                }

                return from(this.doMustStartAsAdmin()).pipe(tap(admin => {
                    launchOptions.admin = admin;
                }));
            }),
            switchMap(() => this.handleLaunchEvents(this.sendLaunch(launchOptions))),
        ));
    }

    public createLaunchShortcut(launchOptions: LaunchOption, steamShortcut: boolean): Observable<boolean>{
        const options: LaunchOption = {...launchOptions, version: {...launchOptions.version, color: launchOptions.version.color || this.theme.getBsmColors()[1]}};
        return this.ipcService.sendV2("create-launch-shortcut", { options, steamShortcut });
    }

    public restoreSteamVR(): Promise<void>{
        return lastValueFrom(this.ipcService.sendV2("bs-launch.restore-steamvr"));
    }
}
