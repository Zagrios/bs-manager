import { BSVersion } from "shared/bs-version.interface";
import { BehaviorSubject, Observable } from "rxjs";
import { IpcService } from "./ipc.service";
import { ModalExitCode, ModalService } from "./modale.service";
import { NotificationService } from "./notification.service";
import { ProgressBarService } from "./progress-bar.service";
import { EditVersionModal } from "renderer/components/modal/modal-types/edit-version-modal.component";
import { popElement } from "shared/helpers/array.helpers";

export class BSVersionManagerService {
    private static instance: BSVersionManagerService;

    private readonly ipcService: IpcService;
    private readonly modalService: ModalService;
    private readonly notificationService: NotificationService;
    private readonly progressBarService: ProgressBarService;

    public readonly installedVersions$: BehaviorSubject<BSVersion[]> = new BehaviorSubject([]);
    public readonly availableVersions$: BehaviorSubject<BSVersion[]> = new BehaviorSubject([]);

    private constructor() {
        this.ipcService = IpcService.getInstance();
        this.modalService = ModalService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.progressBarService = ProgressBarService.getInstance();
        this.askAvailableVersions().then(() => this.askInstalledVersions());
    }

    public static getInstance() {
        if (!BSVersionManagerService.instance) {
            BSVersionManagerService.instance = new BSVersionManagerService();
        }
        return BSVersionManagerService.instance;
    }

    public setInstalledVersions(versions: BSVersion[]) {
        const sorted = BSVersionManagerService.sortVersions(versions);
        this.installedVersions$.next(BSVersionManagerService.removeDuplicateVersions(sorted));
    }

    public getInstalledVersions(): BSVersion[] {
        return this.installedVersions$.value;
    }

    public askAvailableVersions(): Promise<BSVersion[]> {
        return this.ipcService.send<BSVersion[]>("bs-version.get-version-dict").then(res => {
            this.availableVersions$.next(res.data);
            return res.data;
        });
    }

    public askInstalledVersions(): Promise<BSVersion[]> {
        return this.ipcService.send<BSVersion[]>("bs-version.installed-versions").then(res => {
            this.setInstalledVersions(res.data);
            return res.data;
        });
    }

    public isVersionInstalled(version: BSVersion): boolean {
        return !!this.getInstalledVersions().find(v => v.BSVersion === version.BSVersion && v.steam === version.steam && v.oculus === version.oculus);
    }

    public async editVersion(version: BSVersion): Promise<BSVersion> {
        const modalRes = await this.modalService.openModal(EditVersionModal, { version, clone: false });
        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return null;
        }
        if (modalRes.data.name?.length < 2) {
            return null;
        }
        return this.ipcService.send<BSVersion>("bs-version.edit", { args: { version, name: modalRes.data.name, color: modalRes.data.color } }).then(res => {
            if (!res.success) {
                this.notificationService.notifyError({
                    title: `notifications.custom-version.errors.titles.${res.error.title}`,
                    ...(res.error.message && { desc: `notifications.custom-version.errors.msg.${res.error.message}` }),
                });
                return null;
            }
            this.askInstalledVersions();
            return res.data;
        });
    }

    public async cloneVersion(version: BSVersion): Promise<BSVersion> {
        if (!this.progressBarService.require()) {
            return null;
        }
        const modalRes = await this.modalService.openModal(EditVersionModal, { version, clone: true });
        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return null;
        }
        if (modalRes.data.name?.length < 2) {
            return null;
        }
        this.progressBarService.showFake(0.01);
        return this.ipcService.send<BSVersion>("bs-version.clone", { args: { version, name: modalRes.data.name, color: modalRes.data.color } }).then(res => {
            this.progressBarService.hide(true);
            if (!res.success) {
                this.notificationService.notifyError({
                    title: `notifications.custom-version.errors.titles.${res.error.title}`,
                    ...(res.error.message && { desc: `notifications.custom-version.errors.msg.${res.error.message}` }),
                });
                return null;
            }
            this.notificationService.notifySuccess({ title: "notifications.custom-version.success.titles.CloningFinished" });
            this.askInstalledVersions();
            return res.data;
        });
    }

    public getVersionPath(version: BSVersion): Observable<string> {
        return this.ipcService.sendV2("get-version-full-path", { args: version });
    }

    public static sortVersions(versions: BSVersion[]): BSVersion[] {
        const steamVersion = popElement(v => v.steam, versions);
        const oculusVersion = popElement(v => v.oculus, versions);

        const compare = (a: BSVersion, b: BSVersion) => ( +b.ReleaseDate - +a.ReleaseDate )

        const sorted: BSVersion[] = versions.sort(compare);

        sorted.unshift(...[steamVersion, oculusVersion].filter(Boolean).sort(compare));

        return sorted;
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
}
