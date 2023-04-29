import { MSModelType } from "shared/models/model-saber/model-saber.model";
import { IpcService } from "../ipc.service";
import { VersionFolderLinkerService, VersionLinkerActionType } from "../version-folder-linker.service";
import { MODEL_TYPE_FOLDERS } from "shared/models/model-saber/models-constants";
import { Observable, distinctUntilChanged, lastValueFrom, mergeMap, share } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { ModalExitCode, ModalService } from "../modale.service";
import { LinkModelsModal } from "renderer/components/modal/modal-types/models/link-models-modal.component";
import { UnlinkModelsModal } from "renderer/components/modal/modal-types/models/unlink-models-modal.component";

export class ModelsManagerService {

    private static instance: ModelsManagerService;

    public static getInstance(): ModelsManagerService{
        if(!ModelsManagerService.instance){ ModelsManagerService.instance = new ModelsManagerService(); }
        return ModelsManagerService.instance;
    }

    private readonly ipc: IpcService;
    private readonly versionFolderLinked: VersionFolderLinkerService;
    private readonly modalService: ModalService;

    private constructor(){
        this.ipc = IpcService.getInstance();
        this.versionFolderLinked = VersionFolderLinkerService.getInstance();
        this.modalService = ModalService.getInsance();
    }

    public isModelsLinked(version: BSVersion, type: MSModelType): Promise<boolean>{
        return lastValueFrom(this.versionFolderLinked.isVersionFolderLinked(version, MODEL_TYPE_FOLDERS[type]));
    }

    public $modelsLinkingPending(version: BSVersion, type: MSModelType): Observable<boolean>{
        return this.versionFolderLinked.$isVersionFolderPending(version, MODEL_TYPE_FOLDERS[type]);
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