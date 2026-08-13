import { BSVersion } from "shared/bs-version.interface";
import { BehaviorSubject, Observable, Subscription, lastValueFrom, shareReplay, tap, throwError } from "rxjs";
import { IpcService } from "./ipc.service";
import { ModalExitCode, ModalService } from "./modale.service";
import { NotificationService } from "./notification.service";
import { ProgressBarService } from "./progress-bar.service";
import { EditVersionModal } from "renderer/components/modal/modal-types/edit-version-modal.component";
import { popElement } from "shared/helpers/array.helpers";
import { ImportVersionModal } from "renderer/components/modal/modal-types/import-version-modal.component";
import { Progression } from "main/helpers/fs.helpers";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { logRenderError } from "renderer";

export class BSVersionManagerService {
    private static instance: BSVersionManagerService;

    private readonly ipcService: IpcService;
    private readonly modalService: ModalService;
    private readonly notification: NotificationService;
    private readonly progressBar: ProgressBarService;

    private availableVersionsRefreshPromise: Promise<BSVersion[]> | null = null;
    private installedVersionsRequestPromise: Promise<BSVersion[]> | null = null;
    private installedVersionsRescanQueued = false;
    public readonly installedVersions$: BehaviorSubject<BSVersion[]> = new BehaviorSubject([]);
    public readonly availableVersions$: BehaviorSubject<BSVersion[]> = new BehaviorSubject([]);

    private constructor() {
        this.ipcService = IpcService.getInstance();
        this.modalService = ModalService.getInstance();
        this.notification = NotificationService.getInstance();
        this.progressBar = ProgressBarService.getInstance();

        this.refreshAvailableVersions().catch(logRenderError);
        this.askInstalledVersions().catch(logRenderError);
    }

    public static getInstance() {
        if (!BSVersionManagerService.instance) {
            BSVersionManagerService.instance = new BSVersionManagerService();
        }
        return BSVersionManagerService.instance;
    }

    public setInstalledVersions(versions: BSVersion[]): void {
        this.installedVersions$.next(BSVersionManagerService.normalizeInstalledVersions(versions));
    }

    public getInstalledVersions(): BSVersion[] {
        return this.installedVersions$.value;
    }

    public refreshAvailableVersions(): Promise<BSVersion[]> {
        if (this.availableVersionsRefreshPromise) {
            return this.availableVersionsRefreshPromise;
        }

        let previousVersions: BSVersion[] | null = null;

        const refreshPromise = lastValueFrom(
            this.ipcService.sendV2("bs-version.get-version-dict", { refresh: true }).pipe(
                tap(versions => {
                    this.availableVersions$.next(versions);

                    if (
                        previousVersions
                        && !BSVersionManagerService.haveSameVersionSequence(previousVersions, versions)
                    ) {
                        this.queueInstalledVersionsRescan();
                    }

                    previousVersions = versions;
                }),
            )
        ).finally(() => {
            if (this.availableVersionsRefreshPromise === refreshPromise) {
                this.availableVersionsRefreshPromise = null;
            }
        });

        this.availableVersionsRefreshPromise = refreshPromise;
        return refreshPromise;
    }

    private queueInstalledVersionsRescan(): void {
        if (this.installedVersionsRequestPromise) {
            this.installedVersionsRescanQueued = true;
            return;
        }

        this.askInstalledVersions().catch(logRenderError);
    }

    public askInstalledVersions(): Promise<BSVersion[]> {
        if (this.installedVersionsRequestPromise) {
            return this.installedVersionsRequestPromise;
        }

        const requestPromise = lastValueFrom(this.ipcService.sendV2("bs-version.installed-versions"))
            .then(versions => {
                const normalizedVersions = BSVersionManagerService.normalizeInstalledVersions(versions);
                this.installedVersions$.next(normalizedVersions);
                return normalizedVersions;
            })
            .finally(() => {
                if (this.installedVersionsRequestPromise !== requestPromise) {
                    return;
                }

                this.installedVersionsRequestPromise = null;

                if (this.installedVersionsRescanQueued) {
                    this.installedVersionsRescanQueued = false;
                    this.askInstalledVersions().catch(logRenderError);
                }
            });

        this.installedVersionsRequestPromise = requestPromise;
        return requestPromise;
    }

    public async isVersionInstalled(version: BSVersion): Promise<boolean> {
        try {
            const versions: BSVersion[] = this.installedVersionsRequestPromise
                ? await this.installedVersionsRequestPromise
                : this.getInstalledVersions();

            return !!versions.find(v =>
                v.BSVersion === version.BSVersion
                && v.name === version.name
                && v.steam === version.steam
                && v.oculus === version.oculus
            );
        } catch (error) {
            return false;
        }
    }

    public async editVersion(version: BSVersion): Promise<BSVersion> {
        const modalRes = await this.modalService.openModal(EditVersionModal, {data: { version, clone: false }});
        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return null;
        }
        if (modalRes.data.name?.length < 2) {
            return null;
        }

        return lastValueFrom(this.ipcService.sendV2("bs-version.edit", { version, name: modalRes.data.name, color: modalRes.data.color })).then(res => {
            this.askInstalledVersions().catch(logRenderError);
            return res;
        }).catch(e => {

            const knownErrorTitlesCodes = ["CantEditSteam", "VersionAlreadExist", "CantRename"];
            const knownErrorMessagesCodes = ["CantEditSteam"];

            if(knownErrorTitlesCodes.includes(e.code)){
                this.notification.notifyError({
                    title: `notifications.custom-version.errors.titles.${e.code}`,
                    desc: knownErrorMessagesCodes.includes(e.code) ? `notifications.custom-version.errors.msg.${e.code}` : null
                });
            } else {
                this.notification.notifyError({ title: `notifications.custom-version.errors.titles.UnknownError` });
            }

            return null;
        })
    }

    public async cloneVersion(version: BSVersion): Promise<BSVersion> {
        if (!this.progressBar.require()) {
            return null;
        }
        const modalRes = await this.modalService.openModal(EditVersionModal, {data: { version, clone: true }});
        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return null;
        }
        if (modalRes.data.name?.length < 2) {
            return null;
        }

        this.progressBar.showFake(0.01);

        return lastValueFrom(this.ipcService.sendV2("bs-version.clone", { version, name: modalRes.data.name, color: modalRes.data.color })).then(res => {
            this.notification.notifySuccess({ title: "notifications.custom-version.success.titles.CloningFinished" });
            this.askInstalledVersions().catch(logRenderError);
            return res;
        }).catch((e: CustomError) => {

            const knownErrorTitlesCodes = ["VersionAlreadExist", "CantClone"];

            if(knownErrorTitlesCodes.includes(e.code)){
                this.notification.notifyError({ title: `notifications.custom-version.errors.titles.${e.code}` });
            } else {
                this.notification.notifyError({ title: `notifications.custom-version.errors.titles.UnknownError` });
            }

            return null;
        }).finally(() => {
            this.progressBar.hide()
        });
    }

    public importVersion(): Observable<Progression<BSVersion>> {
        if(!this.progressBar.require()){
            return throwError(() => new Error("Action already in progress"));
        }

        const obs$ = new Observable<Progression<BSVersion>>(obs => {

            const subs: Subscription[] = [];

            (async () => {

                const resModal = await this.modalService.openModal(ImportVersionModal);
                if(resModal.exitCode !== ModalExitCode.COMPLETED){
                    return;
                }

                const store = resModal.data;

                const folderRes = await lastValueFrom(this.ipcService.sendV2("choose-folder"));
                if(!folderRes || folderRes.canceled || !folderRes.filePaths?.length){
                    return;
                }

                const import$ = this.ipcService.sendV2("import-version", {fromPath: folderRes.filePaths.at(0), store});

                subs.push(import$.subscribe(obs));

                await lastValueFrom(import$);

                this.notification.notifySuccess({ title: "notifications.bs-import-version.success.imported.title", duration: 3_000 });

            })().then(() => {
                obs.complete()
            }).catch(err => {
                this.notification.notifyError({ title: "notifications.types.error", desc: "notifications.bs-import-version.errors.import-error.desc" });
                obs.error(err)
            }).finally(() => {
                this.askInstalledVersions().catch(logRenderError);
                this.progressBar.hide();
            });

            return () => {
                subs.forEach(sub => sub.unsubscribe());
            }
        }).pipe(
            shareReplay({ bufferSize: 1, refCount: true })
        );

        this.progressBar.show(obs$);

        return obs$;
    }

    public getVersionPath(version: BSVersion): Observable<string> {
        return this.ipcService.sendV2("get-version-full-path", version);
    }

    public static sortVersions(versions: BSVersion[]): BSVersion[] {
        const sorted = [...versions];
        const steamVersion = popElement(v => v.steam, sorted);
        const oculusVersion = popElement(v => v.oculus, sorted);

        const compare = (a: BSVersion, b: BSVersion) => ( +b.ReleaseDate - +a.ReleaseDate );

        sorted.sort(compare);

        sorted.unshift(...[steamVersion, oculusVersion].filter(Boolean).sort(compare));

        return sorted;
    }

    public static normalizeInstalledVersions(versions: BSVersion[]): BSVersion[] {
        return BSVersionManagerService.removeDuplicateVersions(
            BSVersionManagerService.sortVersions(versions)
        );
    }

    private static haveSameVersionSequence(first: BSVersion[], second: BSVersion[]): boolean {
        return first.length === second.length
            && first.every((version, index) => version.BSVersion === second[index].BSVersion);
    }

    public static removeDuplicateVersions(versions: BSVersion[]): BSVersion[] {
        return Array.from(new Map(versions.map(version => ([
            JSON.stringify([
                version.BSVersion,
                version.BSManifest,
                version.name,
                version.steam,
                version.oculus
            ]),
            version
        ]))).values());
    }

    public getRecommendedVersion(): BSVersion | undefined {
        return (this.availableVersions$.value ?? []).find(v => v.recommended);
    }
}
