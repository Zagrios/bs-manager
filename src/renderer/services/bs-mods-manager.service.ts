import { BehaviorSubject } from "rxjs";
import { map } from "rxjs/operators";
import { BSVersion } from "shared/bs-version.interface";
import { Mod, ModInstallProgression } from "shared/models/mods/mod.interface";
import { IpcService } from "./ipc.service";
import { ModalExitCode, ModalService, ModalType } from "./modale.service";
import { NotificationService } from "./notification.service";
import { ProgressBarService } from "./progress-bar.service";

export class BsModsManagerService {

    private static instance: BsModsManagerService;

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

    public installMods(mods: Mod[], version: BSVersion){
        if(!this.progressBar.require()){ return; }

        const progress$ = this.ipcService.watch<ModInstallProgression>("mod-installed").pipe(map(res => res.data.progression));
        this.progressBar.show(progress$, true, {paddingLeft: "190px", paddingRight: "190px", bottom: "20px"});

        this.isInstalling$.next(true);
        return this.ipcService.send<number, {mods: Mod[], version: BSVersion}>("install-mods", {args: {mods, version}}).then(res => {

            this.isInstalling$.next(false);
            this.progressBar.hide();
        });
    }
    public async uninstallMod(mod: Mod, version: BSVersion){
        const modalRes = await this.modals.openModal(ModalType.UNINSTALL_MOD, mod);

        if(modalRes.exitCode !== ModalExitCode.COMPLETED || !this.progressBar.require()){ return; }

        const progress$ = this.ipcService.watch<ModInstallProgression>("mod-uninstalled").pipe(map(res => res.data.progression));
        this.progressBar.show(progress$, true, {paddingLeft: "190px", paddingRight: "190px", bottom: "20px"});

        this.isUninstalling$.next(true);
        return this.ipcService.send("uninstall-mods", {args: {mods: [mod], version}}).then(res => {
            this.isUninstalling$.next(false);
            this.progressBar.hide();
        });
    }

    public async uninstallAllMods(version: BSVersion){

        //TODO MODAL

        const progress$ = this.ipcService.watch<ModInstallProgression>("mod-uninstalled").pipe(map(res => res.data.progression));
        this.progressBar.show(progress$, true, {paddingLeft: "190px", paddingRight: "190px", bottom: "20px"});

        this.isUninstalling$.next(true);
        return this.ipcService.send("uninstall-all-mods", {args: version}).then(res => {
            this.isUninstalling$.next(false);
            this.progressBar.hide();
        });

    }

    public isModsAvailable(version: BSVersion): Promise<boolean>{
        throw "NOT IMPLEMENTED YET";
    }

}