import { Observable, BehaviorSubject, throwError, of, lastValueFrom } from "rxjs";
import { catchError, map, tap } from "rxjs/operators";
import { BSVersion } from "shared/bs-version.interface";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { NotificationService } from "./notification.service";
import { Progression } from "main/helpers/fs.helpers";
import { ProgressionInterface } from "shared/models/progress-bar";
import { BbmFullMod, BbmModVersion } from "shared/models/mods/mod.interface";
import { logRenderError } from "renderer";
import { ModsGridStatus } from "shared/models/mods/mod-ipc.model";
import { LinuxService } from "./linux.service";

export class BsModsManagerService {
    private static instance: BsModsManagerService;

    private readonly NOTIFICATION_DURATION = 3000;

    private readonly ipcService: IpcService;
    private readonly progressBar: ProgressBarService;
    private readonly notifications: NotificationService;
    private readonly linux: LinuxService

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
        this.linux = LinuxService.getInstance();
    }

    public getAvailableMods(version: BSVersion): Observable<BbmFullMod[]> {
        return this.ipcService.sendV2("bs-mods.get-available-mods", version);
    }

    public getInstalledMods(version: BSVersion): Observable<BbmModVersion[]> {
        return this.ipcService.sendV2("bs-mods.get-installed-mods", version);
    }

    public isModded(version: BSVersion): Promise<boolean> {
        return lastValueFrom(this.ipcService.sendV2("bs-mods.is-modded", version));
    }

    public installMods(mods: BbmFullMod[], version: BSVersion): Observable<Progression> {

        if (!this.progressBar.require()) {
            return throwError(() => new Error("Action already in progress"));
        }

        return new Observable<Progression>(obs => {
            const install$ = this.ipcService.sendV2("bs-mods.install-mods", { mods, version });
            this.progressBar.show(install$.pipe(catchError(() => of({ current: 0, total: 0} as Progression))));


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

    public uninstallMod(mod: BbmFullMod, version: BSVersion): Observable<Progression> {
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

    public async getVersionModsState(version: BSVersion): Promise<{available: BbmFullMod[], installed: BbmFullMod[]}> {
        const [available, installed]: [BbmFullMod[], BbmModVersion[]] = await (async () => {
            const available = await lastValueFrom(this.getAvailableMods(version));
            const installed = await lastValueFrom(this.getInstalledMods(version));
            return [available ?? [], installed ?? []] as [BbmFullMod[], BbmModVersion[]]; // Make TS happy
        })().catch(e => {
            logRenderError(e);
            return [[], []] as [BbmFullMod[], BbmModVersion[]]; // Make TS happy
        })

        const installedMods: BbmFullMod[] = installed.reduce((acc, installedMod) => {
            const mod = available.find(m => m.mod.id === installedMod.modId);

            if(mod){
                acc.push({ ...mod, version: installedMod } as BbmFullMod);
            }

            return acc;
        }, []);

        return { available: (available ?? []), installed: (installedMods ?? []) };
    }

    public async getModsGridStatus(): Promise<ModsGridStatus> {

        if(window.electron.platform === "linux"){
            const winePrefix = await lastValueFrom(this.linux.getWinePrefixPath());
            if(!winePrefix){
                logRenderError("Could not find BSManager WINEPREFIX path");
                return ModsGridStatus.NO_WINEPREFIX;
            }
        }

        const beatModsUp = await lastValueFrom(this.ipcService.sendV2("bs-mods.beatmods-up")).catch(() => false);
        if (!beatModsUp) {
            return ModsGridStatus.BEATMODS_DOWN;
        }

        return ModsGridStatus.OK;
    }

}
