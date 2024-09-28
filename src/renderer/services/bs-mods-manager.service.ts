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
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { ExternalMod } from "shared/models/mods/mod.interface";
import { IpcResponse } from "shared/models/ipc";

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

    public getInstalledExternalMods(version: BSVersion): Observable<{ [key: string]: ExternalMod }> {
        return this.ipcService.sendV2("bs-mods.get-installed-external-mods", version);
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

        return lastValueFrom(this.ipcService.sendV2("bs-mods.install-mods", { mods, version })).then(res => {
            const isFullyInstalled = res.nbInstalledMods === res.nbModsToInstall;

            const title = `notifications.mods.install-mods.titles.${isFullyInstalled ? "success" : "warning"}`;
            const desc = `notifications.mods.install-mods.msg.${isFullyInstalled ? "success" : "warning"}`;

            this.notifications.notify({ type: isFullyInstalled ? NotificationType.SUCCESS : NotificationType.WARNING, title, desc, duration: this.NOTIFICATION_DURATION });
        }).catch((e: CustomError) => {
            this.notifications.notifyError({ title: "notifications.types.error", desc: `notifications.mods.install-mods.msg.errors.${e?.code}`, duration: this.NOTIFICATION_DURATION });
        }).finally(() => {
            this.isInstalling$.next(false);
            this.progressBar.hide();
        })
    }

    public async toggleMods(externalMods: ExternalMod[], version: BSVersion): Promise<ExternalMod[]> {
        if (!this.progressBar.require()) {
            return Promise.resolve([]);
        }

        const progress$: Observable<ProgressionInterface> = this.ipcService
            .watch<IpcResponse<ModInstallProgression>>("mod-installed")
            .pipe(map(res => ({
                progression: res.data.progression,
                label: res.data.name
            } as ProgressionInterface)));

        this.progressBar.show(progress$, true, { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });
        this.isInstalling$.next(true);

        try {
            const editedMods = await lastValueFrom(this.ipcService.sendV2(
                "bs-mods.toggle-mods",
                { externalMods, version }
            ));
            const title = `notifications.mods.toggle-mods.titles.success`;
            const desc = `notifications.mods.toggle-mods.msgs.success`;

            this.notifications.notify({
                type: NotificationType.SUCCESS,
                title, desc,
                duration: this.NOTIFICATION_DURATION
            });
            return editedMods;
        } catch (error: any) {
            this.notifications.notifyError({
                title: "notifications.mods.toggle-mods.titles.error",
                desc: ["no-mods-toggled"].includes(error?.code)
                    ? `notifications.mods.toggle-mods.msgs.${error.code}`
                    : "Unknown",
                duration: this.NOTIFICATION_DURATION
            });
            return [];
        } finally {
            this.isInstalling$.next(false);
            this.progressBar.hide();
        }
    }

    public async uninstallMod(mod: Mod, version: BSVersion): Promise<void> {
        if (!this.progressBar.require()) {
            return;
        }

        const modalRes = await this.modals.openModal(UninstallModModal, { data: mod.name });

        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return;
        }

        const progress$ = this.ipcService.watch<ModInstallProgression>("mod-uninstalled").pipe(map(res => res.data.progression));
        this.progressBar.show(progress$, true, { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

        this.isUninstalling$.next(true);

        return lastValueFrom(this.ipcService.sendV2("bs-mods.uninstall-mods", {
            mods: [mod],
            externalMods: [],
            version
        })).then(() => {
            this.notifications.notifySuccess({ title: "notifications.mods.uninstall-mod.titles.success", duration: this.NOTIFICATION_DURATION });
        }).catch((e: CustomError) => {
            this.notifications.notifyError({ title: "notifications.types.error", desc: `notifications.mods.uninstall-mod.msg.errors.${e?.code}`, duration: this.NOTIFICATION_DURATION });
        }).finally(() => {
            this.isUninstalling$.next(false);
            this.progressBar.hide();
        })
    }

    public async uninstallExternalMod(mod: ExternalMod, version: BSVersion): Promise<boolean> {
        if (!this.progressBar.require()) {
            return false;
        }

        const modalRes = await this.modals.openModal(UninstallModModal, { data: mod.name });

        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return false;
        }

        const progress$ = this.ipcService.watch<ModInstallProgression>("mod-uninstalled").pipe(map(res => res.data.progression));
        this.progressBar.show(progress$, true, { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

        this.isUninstalling$.next(true);

        return lastValueFrom(this.ipcService.sendV2("bs-mods.uninstall-mods", {
            mods: [],
            externalMods: [mod],
            version
        })).then(() => {
            this.notifications.notifySuccess({
                title: "notifications.mods.uninstall-mod.titles.success",
                duration: this.NOTIFICATION_DURATION
            });
            return true;
        }).catch((e: CustomError) => {
            this.notifications.notifyError({
                title: "notifications.types.error",
                desc: `notifications.mods.uninstall-mod.msg.errors.${e?.code}`,
                duration: this.NOTIFICATION_DURATION
            });
            return false;
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
        return lastValueFrom(this.ipcService.sendV2("bs-mods.uninstall-all-mods", version)).then(() => {
            this.notifications.notifySuccess({ title: "notifications.mods.uninstall-all-mods.titles.success", desc: "notifications.mods.uninstall-all-mods.msg.success", duration: this.NOTIFICATION_DURATION });
        }).catch((e: CustomError) => {
            this.notifications.notifyError({ title: "notifications.types.error", desc: `notifications.mods.uninstall-all-mods.msg.errors.${e?.code}`, duration: this.NOTIFICATION_DURATION });
        }).finally(() => {
            this.isUninstalling$.next(false);
            this.progressBar.hide();
        })
    }
}
