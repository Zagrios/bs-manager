import { UninstallAllModsModal } from "renderer/components/modal/modal-types/uninstall-all-mods-modal.component";
import { UninstallModModal } from "renderer/components/modal/modal-types/uninstall-mod-modal.component";
import { Observable, BehaviorSubject, lastValueFrom } from "rxjs";
import { map } from "rxjs/operators";
import { BSVersion } from "shared/bs-version.interface";
import { Mod, ModInstallProgression } from "shared/models/mods";
import { ProgressionInterface } from "shared/models/progress-bar";
import { IpcService } from "./ipc.service";
import { ModalExitCode, ModalService } from "./modale.service";
import { NotificationType } from "../../shared/models/notification/notification.model";
import { OsDiagnosticService } from "./os-diagnostic.service";
import { ProgressBarService } from "./progress-bar.service";
import { NotificationService } from "./notification.service";

export class BsModsManagerService {
    private static instance: BsModsManagerService;

    private readonly NOTIFICATION_DURATION = 3000;

    private readonly ipcService: IpcService;
    private readonly progressBar: ProgressBarService;
    private readonly modals: ModalService;
    private readonly notifications: NotificationService;
    private readonly os: OsDiagnosticService;

    public readonly isInstalling$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public readonly isUninstalling$: BehaviorSubject<boolean> = new BehaviorSubject(false);

    public static getInstance(): BsModsManagerService {
        if (!BsModsManagerService.instance) {
            BsModsManagerService.instance = new BsModsManagerService();
        }
        return BsModsManagerService.instance;
    }

    private constructor() {
        this.ipcService = IpcService.getInstance();
        this.progressBar = ProgressBarService.getInstance();
        this.modals = ModalService.getInstance();
        this.notifications = NotificationService.getInstance();
        this.os = OsDiagnosticService.getInstance();
    }

    public getAvailableMods(version: BSVersion): Observable<Mod[]> {
        return this.ipcService.sendV2("get-available-mods", version);
    }

    public getInstalledMods(version: BSVersion): Observable<Mod[]> {
        return this.ipcService.sendV2("get-installed-mods", version);
    }

    public installMods(mods: Mod[], version: BSVersion): Promise<void> {
        if (this.os.isOffline) {
            this.notifications.notifyError({
                title: "notifications.shared.errors.titles.no-internet",
                desc: "notifications.shared.errors.msg.no-internet",
            });
            return Promise.resolve();
        }

        if (!this.progressBar.require()) {
            return Promise.resolve();
        }

        const progress$: Observable<ProgressionInterface> = this.ipcService.watch<ModInstallProgression>("mod-installed").pipe(
            map(res => {
                return { progression: res.data.progression, label: res.data.name } as ProgressionInterface;
            })
        );

        this.progressBar.show(progress$, true, { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

        this.isInstalling$.next(true);

        return lastValueFrom(this.ipcService.sendV2("install-mods", { mods, version })).then(res => {
            const isFullyInstalled = res.nbInstalledMods === res.nbModsToInstall;

            const title = `notifications.mods.install-mods.titles.${isFullyInstalled ? "success" : "warning"}`;
            const desc = `notifications.mods.install-mods.msg.${isFullyInstalled ? "success" : "warning"}`;

            this.notifications.notify({ type: isFullyInstalled ? NotificationType.SUCCESS : NotificationType.WARNING, title, desc, duration: this.NOTIFICATION_DURATION });
        }).catch(e => {
            this.notifications.notifyError({ title: "notifications.types.error", desc: `notifications.mods.install-mods.msg.errors.${e}`, duration: this.NOTIFICATION_DURATION });
        }).finally(() => {
            this.isInstalling$.next(false);
            this.progressBar.hide();
        })
    }
    public async uninstallMod(mod: Mod, version: BSVersion): Promise<void> {
        if (!this.progressBar.require()) {
            return;
        }

        const modalRes = await this.modals.openModal(UninstallModModal, {data: mod});

        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return;
        }

        const progress$ = this.ipcService.watch<ModInstallProgression>("mod-uninstalled").pipe(map(res => res.data.progression));
        this.progressBar.show(progress$, true, { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

        this.isUninstalling$.next(true);

        return lastValueFrom(this.ipcService.sendV2("uninstall-mods", { mods: [mod], version })).then(() => {
            this.notifications.notifySuccess({ title: "notifications.mods.uninstall-mod.titles.success", duration: this.NOTIFICATION_DURATION });
        }).catch(e => {
            this.notifications.notifyError({ title: "notifications.types.error", desc: `notifications.mods.uninstall-mod.msg.errors.${e}`, duration: this.NOTIFICATION_DURATION });
        }).finally(() => {
            this.isUninstalling$.next(false);
            this.progressBar.hide();
        })
    }

    public async uninstallAllMods(version: BSVersion) {
        if (!this.progressBar.require()) {
            return;
        }

        const modalRes = await this.modals.openModal(UninstallAllModsModal, {data: version});

        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return;
        }

        const progress$ = this.ipcService.watch<ModInstallProgression>("mod-uninstalled").pipe(map(res => res.data.progression));
        this.progressBar.show(progress$, true, { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

        this.isUninstalling$.next(true);
        return lastValueFrom(this.ipcService.sendV2("uninstall-all-mods", version)).then(() => {
            this.notifications.notifySuccess({ title: "notifications.mods.uninstall-all-mods.titles.success", desc: "notifications.mods.uninstall-all-mods.msg.success", duration: this.NOTIFICATION_DURATION });
        }).catch(e => {
            this.notifications.notifyError({ title: "notifications.types.error", desc: `notifications.mods.uninstall-all-mods.msg.errors.${e}`, duration: this.NOTIFICATION_DURATION });
        }).finally(() => {
            this.isUninstalling$.next(false);
            this.progressBar.hide();
        })
    }
}
