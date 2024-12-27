import { Observable, BehaviorSubject, throwError, of, lastValueFrom } from "rxjs";
import { catchError, map, tap } from "rxjs/operators";
import { BSVersion } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { NotificationService } from "./notification.service";
import { Progression } from "main/helpers/fs.helpers";
import { ProgressionInterface } from "shared/models/progress-bar";

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
        return this.ipcService.sendV2("bs-mods.get-available-mods", version);
    }

    public getInstalledMods(version: BSVersion): Observable<Mod[]> {
        return this.ipcService.sendV2("bs-mods.get-installed-mods", version);
    }

    public installMods(mods: Mod[], version: BSVersion): Observable<Progression> {

        if (!this.progressBar.require()) {
            return throwError(() => new Error("Action already in progress"));
        }

        return new Observable<Progression>(obs => {
            const install$ = this.ipcService.sendV2("bs-mods.install-mods", { mods, version });
            this.progressBar.show(install$.pipe(catchError(() => of({ current: 0, total: 0} as Progression))), { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

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
                this.progressBar.hide();
            }
        });
    }

    public uninstallMod(mod: Mod, version: BSVersion): Observable<Progression> {
        if (!this.progressBar.require()) {
            return throwError(() => new Error("Action already in progress"));
        }

        return new Observable<Progression>(obs => {
            const uninstall$ = this.ipcService.sendV2("bs-mods.uninstall-mods", { mods: [mod], version });
            this.progressBar.show(uninstall$.pipe(catchError(() => of({ current: 0, total: 0} as Progression))), { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

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
                this.progressBar.hide();
            }
        });
    }

    public async importMods(paths: string[], version: BSVersion): Promise<void> {
        if (!this.progressBar.require()) {
            throw new Error("Action already in progress");
        }

        // TODO: Check for conflicting mod files, and ask the user if they want to overwrite the files

        const import$ = this.ipcService.sendV2("bs-mods.import-mods", {
            paths, version
        });

        this.progressBar.show(import$.pipe(
            catchError(() => of()),
            map(progress => ({
                progression: (progress.current / progress.total) * 100,
                label: progress.data?.name
            }) as ProgressionInterface)
        ));

        return lastValueFrom(import$)
            .then(progress => {
                if (progress.current === 0) {
                    return;
                }
                this.notifications.notifySuccess({
                    title: "notifications.mods.import-mod.titles.success",
                    desc: progress.current === progress.total
                        ? "notifications.mods.import-mod.msgs.success"
                        : "notifications.mods.import-mod.msgs.some-success",
                });
            })
            .catch(error => {
                this.notifications.notifyError({
                    title: "notifications.mods.import-mod.titles.error",
                    desc: ["no-dlls"].includes(error?.code)
                        ? `notifications.mods.import-mod.msgs.${error.code}`
                        : "misc.unknown",
                });
            })
            .finally(() => {
                this.progressBar.hide();
            });
    }

    public uninstallAllMods(version: BSVersion): Observable<Progression> {
        if (!this.progressBar.require()) {
            return throwError(() => new Error("Action already in progress"));
        }

        return new Observable<Progression>(obs => {
            const uninstall$ = this.ipcService.sendV2("bs-mods.uninstall-all-mods", version);
            this.progressBar.show(uninstall$.pipe(catchError(() => of({ current: 0, total: 0} as Progression))), { paddingLeft: "190px", paddingRight: "190px", bottom: "20px" });

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
                this.progressBar.hide();
            }

        });
    }

}
