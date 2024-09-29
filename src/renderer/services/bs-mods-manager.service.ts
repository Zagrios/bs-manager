import { Observable, BehaviorSubject, throwError, of } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { BSVersion } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { NotificationService } from "./notification.service";
import { Progression } from "main/helpers/fs.helpers";

export class BsModsManagerService {
    private static instance: BsModsManagerService;

    private readonly NOTIFICATION_DURATION = 3000;

    private readonly ipcService: IpcService;
    private readonly progressBar: ProgressBarService;
    private readonly notifications: NotificationService;

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
        this.notifications = NotificationService.getInstance();
    }

    public getAvailableMods(version: BSVersion): Observable<Mod[]> {
        return this.ipcService.sendV2("get-available-mods", version);
    }

    public getInstalledMods(version: BSVersion): Observable<Mod[]> {
        return this.ipcService.sendV2("get-installed-mods", version);
    }

    public installMods(mods: Mod[], version: BSVersion): Observable<Progression> {

        if (!this.progressBar.require()) {
            return throwError(() => new Error("Action already in progress"));
        }

        return new Observable<Progression>(obs => {
            const install$ = this.ipcService.sendV2("install-mods", { mods, version });
            this.progressBar.show(install$.pipe(catchError(() => of({ current: 0, total: 0} as Progression))), true, { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

            const sub = install$.pipe(
                tap({
                    error: err => {
                        if(err?.code){
                            this.notifications.notifyError({ title: "notifications.types.error", desc: `notifications.mods.install-mods.msg.errors.${err?.code}`, duration: this.NOTIFICATION_DURATION });
                        } else {
                            this.notifications.notifyError({ title: "notifications.types.error", desc: err?.message ?? err, duration: this.NOTIFICATION_DURATION });
                        }
                    },
                    complete: () => {
                        this.notifications.notifySuccess({ title: "notifications.mods.install-mods.titles.success", desc: "notifications.mods.install-mods.msg.success", duration: this.NOTIFICATION_DURATION });
                    },
                })
            ).subscribe(obs);

            return () => {
                sub.unsubscribe();
                this.progressBar.hide(true);
            }
        });
    }

    public uninstallMod(mod: Mod, version: BSVersion): Observable<Progression> {
        if (!this.progressBar.require()) {
            return throwError(() => new Error("Action already in progress"));
        }

        return new Observable<Progression>(obs => {
            const uninstall$ = this.ipcService.sendV2("uninstall-mods", { mods: [mod], version });
            this.progressBar.show(uninstall$.pipe(catchError(() => of({ current: 0, total: 0} as Progression))), true, { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

            const sub = uninstall$.pipe(
                tap({
                    error: err => {
                        if(err?.code){
                            this.notifications.notifyError({ title: "notifications.types.error", desc: `notifications.mods.uninstall-mod.msg.errors.${err?.code}`, duration: this.NOTIFICATION_DURATION });
                        } else {
                            this.notifications.notifyError({ title: "notifications.types.error", desc: err?.message ?? err, duration: this.NOTIFICATION_DURATION });
                        }
                    },
                    complete: () => {
                        this.notifications.notifySuccess({ title: "notifications.mods.uninstall-mod.titles.success", duration: this.NOTIFICATION_DURATION });
                    },
                })
            ).subscribe(obs);

            return () => {
                sub.unsubscribe();
                this.progressBar.hide(true);
            }
        });
    }

    public uninstallAllMods(version: BSVersion): Observable<Progression> {
        if (!this.progressBar.require()) {
            return throwError(() => new Error("Action already in progress"));
        }

        return new Observable<Progression>(obs => {
            const uninstall$ = this.ipcService.sendV2("uninstall-all-mods", version);
            this.progressBar.show(uninstall$.pipe(catchError(() => of({ current: 0, total: 0} as Progression))), true, { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

            const sub = uninstall$.pipe(
                tap({
                    error: err => {
                        if(err?.code){
                            this.notifications.notifyError({ title: "notifications.types.error", desc: `notifications.mods.uninstall-all-mods.msg.errors.${err?.code}`, duration: this.NOTIFICATION_DURATION });
                        } else {
                            this.notifications.notifyError({ title: "notifications.types.error", desc: err?.message ?? err, duration: this.NOTIFICATION_DURATION });
                        }
                    },
                    complete: () => {
                        this.notifications.notifySuccess({ title: "notifications.mods.uninstall-all-mods.titles.success", desc: "notifications.mods.uninstall-all-mods.msg.success", duration: this.NOTIFICATION_DURATION });
                    },
                })
            ).subscribe(obs);

            return () => {
                sub.unsubscribe();
                this.progressBar.hide(true);
            }

        });
    }
}
