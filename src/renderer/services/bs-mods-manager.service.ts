import { Observable } from "rxjs";
import { BehaviorSubject } from "rxjs";
import { map } from "rxjs/operators";
import { BSVersion } from "shared/bs-version.interface";
import { InstallModsResult, UninstallModsResult } from "shared/models/mods";
import { Mod, ModInstallProgression } from "shared/models/mods";
import { ProgressionInterface } from "shared/models/progress-bar";
import { IpcService } from "./ipc.service";
import { ModalExitCode, ModalService, ModalType } from "./modale.service";
import { NotificationService, NotificationType } from "./notification.service";
import { ProgressBarService } from "./progress-bar.service";

export class BsModsManagerService {

    private static instance: BsModsManagerService;

    private readonly NOTIFICATION_DURATION = 3000;

    private readonly ipcService: IpcService;
    private readonly progressBar: ProgressBarService;
    private readonly modals: ModalService;
    private readonly notifications: NotificationService;

    public readonly isInstalling$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public readonly isUninstalling$: BehaviorSubject<boolean> = new BehaviorSubject(false);

    public static getInstance(): BsModsManagerService{
        if(!BsModsManagerService.instance){ BsModsManagerService.instance = new BsModsManagerService(); }
        return BsModsManagerService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();
        this.progressBar = ProgressBarService.getInstance();
        this.modals = ModalService.getInsance();
        this.notifications = NotificationService.getInstance();
    }

    public getAvailableMods(version: BSVersion): Promise<Mod[]>{
        return this.ipcService.send<Mod[], BSVersion>("get-available-mods", {args: version}).then(res => res.data);
    }

    public getInstalledMods(version: BSVersion): Promise<Mod[]>{
        return this.ipcService.send<Mod[], BSVersion>("get-installed-mods", {args: version}).then(res => res.data);
    }

    public installMods(mods: Mod[], version: BSVersion): Promise<void>{
        if(!this.progressBar.require()){ return undefined; }

        const progress$: Observable<ProgressionInterface> = this.ipcService.watch<ModInstallProgression>("mod-installed").pipe(map(res => {
            return {progression: res.data.progression, label: res.data.name} as ProgressionInterface
        }));

        this.progressBar.show(progress$, true, {paddingLeft: "190px", paddingRight: "190px", bottom: "20px"});

        this.isInstalling$.next(true);
        return this.ipcService.send<InstallModsResult, {mods: Mod[], version: BSVersion}>("install-mods", {args: {mods, version}}).then(res => {

            if(res.success && res.data){
                const isFullyInstalled = res.data.nbInstalledMods === res.data.nbModsToInstall;
                const title = `notifications.mods.install-mods.titles.${isFullyInstalled ? "success" : "warning"}`;
                const desc = `notifications.mods.install-mods.msg.${isFullyInstalled ? "success" : "warning"}`;

                this.notifications.notify({type: isFullyInstalled ? NotificationType.SUCCESS : NotificationType.WARNING, title, desc, duration: this.NOTIFICATION_DURATION});
            }
            else{
                this.notifications.notifyError({title: "notifications.types.error", desc: `notifications.mods.install-mods.msg.errors.${res.error}`, duration: this.NOTIFICATION_DURATION})
            }
            this.isInstalling$.next(false);
            this.progressBar.hide();
        });
    }
    public async uninstallMod(mod: Mod, version: BSVersion): Promise<void>{

        if(!this.progressBar.require()){ return; }

        const modalRes = await this.modals.openModal(ModalType.UNINSTALL_MOD, mod);

        if(modalRes.exitCode !== ModalExitCode.COMPLETED){ return; }

        const progress$ = this.ipcService.watch<ModInstallProgression>("mod-uninstalled").pipe(map(res => res.data.progression));
        this.progressBar.show(progress$, true, {paddingLeft: "190px", paddingRight: "190px", bottom: "20px"});

        this.isUninstalling$.next(true);
        return this.ipcService.send("uninstall-mods", {args: {mods: [mod], version}}).then(res => {

            if(res.success){
                this.notifications.notifySuccess({title: "notifications.mods.uninstall-mod.titles.success", duration: this.NOTIFICATION_DURATION})
            }
            else{
                this.notifications.notifyError({title: "notifications.types.error", desc: `notifications.mods.uninstall-mod.msg.errors.${res.error}`, duration: this.NOTIFICATION_DURATION})
            }

            this.isUninstalling$.next(false);
            this.progressBar.hide();
        });
    }

    public async uninstallAllMods(version: BSVersion){

        if(!this.progressBar.require()){ return; }

        const modalRes = await this.modals.openModal(ModalType.UNINSTALL_ALL_MODS, version);

        if(modalRes.exitCode !== ModalExitCode.COMPLETED){ return; }

        const progress$ = this.ipcService.watch<ModInstallProgression>("mod-uninstalled").pipe(map(res => res.data.progression));
        this.progressBar.show(progress$, true, {paddingLeft: "190px", paddingRight: "190px", bottom: "20px"});

        this.isUninstalling$.next(true);
        return this.ipcService.send<UninstallModsResult>("uninstall-all-mods", {args: version}).then(res => {

            if(res.success){
                this.notifications.notifySuccess({title: "notifications.mods.uninstall-all-mods.titles.success", desc: "notifications.mods.uninstall-all-mods.msg.success", duration: this.NOTIFICATION_DURATION})
            }
            else{
                this.notifications.notifyError({title: "notifications.types.error", desc: `notifications.mods.uninstall-all-mods.msg.errors.${res.error}`, duration: this.NOTIFICATION_DURATION})
            }

            this.isUninstalling$.next(false);
            this.progressBar.hide();
        });

    }
}