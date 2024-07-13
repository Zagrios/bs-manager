import { MSModelType } from "shared/models/models/model-saber.model";
import { IpcService } from "../ipc.service";
import { FolderLinkState, VersionFolderLinkerService, VersionLinkerActionListener } from "../version-folder-linker.service";
import { MODEL_TYPE_FOLDERS } from "shared/models/models/constants";
import { Observable, lastValueFrom, map } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { ModalExitCode, ModalService } from "../modale.service";
import { LinkModelsModal } from "renderer/components/modal/modal-types/models/link-models-modal.component";
import { UnlinkModelsModal } from "renderer/components/modal/modal-types/models/unlink-models-modal.component";
import { Progression } from "main/helpers/fs.helpers";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { ProgressBarService } from "../progress-bar.service";
import { ProgressionInterface } from "shared/models/progress-bar";
import { NotificationService } from "../notification.service";
import { ConfigurationService } from "../configuration.service";
import { DeleteModelsModal } from "renderer/components/modal/modal-types/models/delete-models-modal.component";

export class ModelsManagerService {
    private static instance: ModelsManagerService;

    public static readonly REMEMBER_CHOICE_DELETE_MODEL_KEY = "not-confirm-delete-model";

    public static getInstance(): ModelsManagerService {
        if (!ModelsManagerService.instance) {
            ModelsManagerService.instance = new ModelsManagerService();
        }
        return ModelsManagerService.instance;
    }

    private readonly ipc: IpcService;
    private readonly versionFolderLinked: VersionFolderLinkerService;
    private readonly modalService: ModalService;
    private readonly progressBar: ProgressBarService;
    private readonly notifications: NotificationService;
    private readonly config: ConfigurationService;

    private constructor() {
        this.ipc = IpcService.getInstance();
        this.versionFolderLinked = VersionFolderLinkerService.getInstance();
        this.modalService = ModalService.getInstance();
        this.progressBar = ProgressBarService.getInstance();
        this.notifications = NotificationService.getInstance();
        this.config = ConfigurationService.getInstance();
    }

    public isModelsLinked(version: BSVersion, type: MSModelType): Promise<boolean> {
        return lastValueFrom(this.versionFolderLinked.isVersionFolderLinked(version, MODEL_TYPE_FOLDERS[type]));
    }

    public $modelsLinkingPending(version: BSVersion, type: MSModelType): Observable<boolean> {
        return this.versionFolderLinked.$isPending(version, MODEL_TYPE_FOLDERS[type]);
    }

    public $modelsLinkingState(version: BSVersion, type: MSModelType): Observable<FolderLinkState> {
        return this.versionFolderLinked.$folderLinkedState(version, MODEL_TYPE_FOLDERS[type]);
    }

    public onModelsFolderLinked(callback: VersionLinkerActionListener): void {
        return this.versionFolderLinked.onVersionFolderLinked(callback);
    }

    public onModelsFolderUnlinked(callback: VersionLinkerActionListener): void {
        return this.versionFolderLinked.onVersionFolderUnlinked(callback);
    }

    public removeModelsFolderLinkedListener(callback: VersionLinkerActionListener): void {
        return this.versionFolderLinked.removeVersionFolderLinkedListener(callback);
    }

    public removeModelsFolderUnlinkedListener(callback: VersionLinkerActionListener): void {
        return this.versionFolderLinked.removeVersionFolderUnlinkedListener(callback);
    }

    public async linkModels(type: MSModelType, version?: BSVersion): Promise<boolean> {
        const res = await this.modalService.openModal(LinkModelsModal, {data: type});

        if (res.exitCode !== ModalExitCode.COMPLETED) {
            return null;
        }

        return this.versionFolderLinked.linkVersionFolder({
            version,
            relativeFolder: MODEL_TYPE_FOLDERS[type],
            options: { keepContents: res.data !== false },
        });
    }

    public async unlinkModels(type: MSModelType, version?: BSVersion): Promise<boolean> {
        const res = await this.modalService.openModal(UnlinkModelsModal, {data: type});

        if (res.exitCode !== ModalExitCode.COMPLETED) {
            return null;
        }

        return this.versionFolderLinked.unlinkVersionFolder({
            version,
            relativeFolder: MODEL_TYPE_FOLDERS[type],
            options: { keepContents: res.data !== false },
        });
    }

    public $getModels(type: MSModelType, version?: BSVersion): Observable<Progression<BsmLocalModel[]>> {
        return this.ipc.sendV2("get-version-models", { version, type });
    }

    public async exportModels(models: BsmLocalModel[], version?: BSVersion) {
        if (!this.progressBar.require()) {
            return;
        }

        const resFile = await lastValueFrom(this.ipc.sendV2("save-file", {
            filename: version ? `${version.name ?? version.BSVersion} Models` : "Models",
            filters: [{ name: "zip", extensions: ["zip"] }]
        })).catch(() => null as string);

        if (!resFile) {
            return;
        }

        const exportProgress$ = this.ipc.sendV2("export-models", { version, models, outPath: resFile }).pipe(
            map(p => {
                return { progression: (p.current / p.total) * 100, label: `${p.current} / ${p.total}` } as ProgressionInterface;
            })
        );

        this.progressBar.show(exportProgress$, true);

        lastValueFrom(exportProgress$)
            .then(() => {
                this.notifications.notifySuccess({ title: "models.notifications.export-success.title", duration: 3000 });
            })
            .catch(() => {
                this.notifications.notifyError({ title: "notifications.types.error", desc: "notifications.common.msg.error-occurred", duration: 3000 });
            })
            .finally(() => {
                this.progressBar.hide(true);
            });
    }

    public async deleteModels(models: BsmLocalModel[], version?: BSVersion): Promise<BsmLocalModel[]> {
        if (!models?.length) {
            return Promise.resolve([]);
        }

        const askModal = models.length > 1 || !this.config.get<boolean>(ModelsManagerService.REMEMBER_CHOICE_DELETE_MODEL_KEY);

        if (askModal) {
            const types = Array.from(new Set(models.map(m => m.type)));

            const linked = await (async () => {
                if (!version) {
                    return true;
                }
                for (const type of types) {
                    if (!(await this.isModelsLinked(version, type))) {
                        continue;
                    }
                    return true;
                }
                return false;
            })();

            const res = await this.modalService.openModal(DeleteModelsModal, {data: { models, linked }});
            if (res.exitCode !== ModalExitCode.COMPLETED) {
                return Promise.resolve([]);
            }
        }

        const showProgressBar = this.progressBar.require();

        const obs$ = this.ipc.sendV2("delete-models", models);

        const progress$ = obs$.pipe(map(progress => (progress.current / progress.total) * 100));

        if (showProgressBar) {
            this.progressBar.show(progress$);
        }

        return lastValueFrom(obs$)
            .then(({ data }) => data ?? [])
            .catch(() => {
                this.notifications.notifyError({ title: "notifications.types.error", desc: "notifications.common.msg.error-occurred", duration: 3000 });
                return [];
            })
            .finally(() => this.progressBar.hide(true));
    }

    public isDeepLinksEnabled(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2("is-models-deep-links-enabled"));
    }

    public async enableDeepLink(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2("register-models-deep-link"));
    }

    public async disableDeepLink(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2("unregister-models-deep-link"));
    }
}
