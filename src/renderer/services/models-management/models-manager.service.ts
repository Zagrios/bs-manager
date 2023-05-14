import { MSModelType } from "shared/models/models/model-saber.model";
import { IpcService } from "../ipc.service";
import { VersionFolderLinkerService, VersionLinkerActionListener, VersionLinkerActionType } from "../version-folder-linker.service";
import { MODEL_TYPE_FOLDERS } from "shared/models/models/constants";
import { Observable, distinctUntilChanged, lastValueFrom, map, mergeMap, share } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { ModalExitCode, ModalService } from "../modale.service";
import { LinkModelsModal } from "renderer/components/modal/modal-types/models/link-models-modal.component";
import { UnlinkModelsModal } from "renderer/components/modal/modal-types/models/unlink-models-modal.component";
import { Progression } from "main/helpers/fs.helpers";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { ProgressBarService } from "../progress-bar.service";
import { OpenSaveDialogOption } from "shared/models/os/dialog.model";
import { ProgressionInterface } from "shared/models/progress-bar";
import { ArchiveProgress } from "shared/models/archive.interface";
import { NotificationService } from "../notification.service";
import { ConfigurationService } from "../configuration.service";
import { DeleteModelsModal } from "renderer/components/modal/modal-types/models/delete-models-modal.component";

export class ModelsManagerService {

    private static instance: ModelsManagerService;

    public static readonly REMEMBER_CHOICE_DELETE_MODEL_KEY = "not-confirm-delete-model"

    public static getInstance(): ModelsManagerService{
        if(!ModelsManagerService.instance){ ModelsManagerService.instance = new ModelsManagerService(); }
        return ModelsManagerService.instance;
    }

    private readonly ipc: IpcService;
    private readonly versionFolderLinked: VersionFolderLinkerService;
    private readonly modalService: ModalService;
    private readonly progressBar: ProgressBarService;
    private readonly notifications: NotificationService;
    private readonly config: ConfigurationService;

    private constructor(){
        this.ipc = IpcService.getInstance();
        this.versionFolderLinked = VersionFolderLinkerService.getInstance();
        this.modalService = ModalService.getInsance();
        this.progressBar = ProgressBarService.getInstance();
        this.notifications = NotificationService.getInstance();
        this.config = ConfigurationService.getInstance();
    }

    public isModelsLinked(version: BSVersion, type: MSModelType): Promise<boolean>{
        return lastValueFrom(this.versionFolderLinked.isVersionFolderLinked(version, MODEL_TYPE_FOLDERS[type]));
    }

    public $modelsLinkingPending(version: BSVersion, type: MSModelType): Observable<boolean>{
        return this.versionFolderLinked.$isVersionFolderPending(version, MODEL_TYPE_FOLDERS[type]);
    }

    public onModelsFolderLinked(callback: VersionLinkerActionListener): void{
        return this.versionFolderLinked.onVersionFolderLinked(callback);
    }

    public onModelsFolderUnlinked(callback: VersionLinkerActionListener): void{
        return this.versionFolderLinked.onVersionFolderUnlinked(callback);
    }

    public removeModelsFolderLinkedListener(callback: VersionLinkerActionListener): void{
        return this.versionFolderLinked.removeVersionFolderLinkedListener(callback);
    }

    public removeModelsFolderUnlinkedListener(callback: VersionLinkerActionListener): void{
        return this.versionFolderLinked.removeVersionFolderUnlinkedListener(callback);
    }

    public async linkModels(type: MSModelType, version?: BSVersion): Promise<boolean>{

        const res = await this.modalService.openModal(LinkModelsModal, type);

        if(res.exitCode !== ModalExitCode.COMPLETED){ return null; }

        return this.versionFolderLinked.linkVersionFolder({
            version,
            relativeFolder: MODEL_TYPE_FOLDERS[type],
            type: VersionLinkerActionType.Link,
            options: { keepContents: res.data !== false }
        });
    }

    public async unlinkModels(type: MSModelType, version?: BSVersion): Promise<boolean>{

        const res = await this.modalService.openModal(UnlinkModelsModal, type);

        if(res.exitCode !== ModalExitCode.COMPLETED){ return null; }

        return this.versionFolderLinked.unlinkVersionFolder({
            version,
            relativeFolder: MODEL_TYPE_FOLDERS[type],
            type: VersionLinkerActionType.Unlink,
            options: { keepContents: res.data !== false }
        });
    }

    public $getModels(type: MSModelType, version?: BSVersion): Observable<Progression<BsmLocalModel[]>>{
        return this.ipc.sendV2<Progression<BsmLocalModel[]>>("get-version-models", { args: { version, type } });
    }

    public async exportModels(models: BsmLocalModel[], version?: BSVersion){
        if(!this.progressBar.require()){ return; }

        const resFile = await this.ipc.send<string, OpenSaveDialogOption>("save-file", {args: {
            filename: version ? `${version.name ?? version.BSVersion} Models` : "Models",
            filters: [{name: "zip", extensions: ["zip"]}]
        }});

        if(!resFile.success){ return; }

        const exportProgress$: Observable<ProgressionInterface> = this.ipc.sendV2<ArchiveProgress, {version: BSVersion, models: BsmLocalModel[], outPath: string}>("export-models", {args: {version, models, outPath: resFile.data}}).pipe(
            map(p => {
                return { progression: (p.prossesedFiles / p.totalFiles) * 100, label: `${p.prossesedFiles} / ${p.totalFiles}` } as ProgressionInterface
            })
        );

        this.progressBar.show(exportProgress$, true);

        lastValueFrom(exportProgress$).catch(e => {
            this.notifications.notifyError({title: "notifications.types.error"});
        }).then(() => {
            // TODO TRANSLATE
            this.notifications.notifySuccess({title: "TODO TRANSLATE SUCCESS", duration: 3000});
            this.progressBar.complete();
            this.progressBar.hide(true);
        })

    }

    public async deleteModels(models: BsmLocalModel[], version?: BSVersion): Promise<boolean>{

        if(!models){ return Promise.resolve(false); }

        const askModal = models.length > 1 || !this.config.get<boolean>(ModelsManagerService.REMEMBER_CHOICE_DELETE_MODEL_KEY);

        if(askModal){

            const types = Array.from(new Set(models.map(m => m.type)));

            const linked = await (async () => {
                for(const type of types){
                    if(!(await this.isModelsLinked(version, type))){ continue; }
                    return true;
                }
                return false;
            })();

            const res = await this.modalService.openModal(DeleteModelsModal, { models, linked });
            if(res.exitCode !== ModalExitCode.COMPLETED){ return false; }
        }

        const showProgressBar = this.progressBar.require(); 

        const progress$ = this.ipc.sendV2<Progression>("delete-models", {args: models}).pipe(map(progress => (progress.current / progress.total) * 100));

        if(showProgressBar){ this.progressBar.show(progress$); }

        return lastValueFrom(progress$)
            .catch(() => false)
            .then(() => true)
            .finally(() => this.progressBar.hide(true));

    }

    public isDeepLinksEnabled(): Promise<boolean>{
        return this.ipc.send<boolean>("is-models-deep-links-enabled").then(res => (
            res.success ? res.data : false
        ));
    }

    public async enableDeepLink(): Promise<boolean>{
        const res = await this.ipc.send<boolean>("register-models-deep-link");
        return res.success ? res.data : false;
    }

    public async disableDeepLink(): Promise<boolean>{
        const res = await this.ipc.send<boolean>("unregister-models-deep-link");
        return res.success ? res.data : false;
    }

}