import { BehaviorSubject, Observable, Subscription, distinctUntilChanged, filter, map, shareReplay } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { MSModel, MSModelType } from "shared/models/models/model-saber.model";
import { ModalResponse, ModalService } from "../modale.service";
import { IpcService } from "../ipc.service";
import { DownloadModelsModal } from "renderer/components/modal/modal-types/models/download-models-modal.component";

export class ModelsDownloaderService {

    private static instance: ModelsDownloaderService;

    public static getInstance(): ModelsDownloaderService{
        if(!ModelsDownloaderService.instance){ ModelsDownloaderService.instance = new ModelsDownloaderService(); }
        return ModelsDownloaderService.instance;
    }

    private readonly ipc: IpcService;
    private readonly modal: ModalService

    private readonly lastDownloadedModel$ = new BehaviorSubject<ModelDownload>(null);
    private readonly queue$ = new BehaviorSubject<ModelDownload[]>([]);
    private readonly _currentDownload$ = this.queue$.pipe(map(queue => queue.at(0)), distinctUntilChanged(), shareReplay(1));

    private constructor(){

        this.ipc = IpcService.getInstance();
        this.modal = ModalService.getInsance();

        this._currentDownload$.pipe(filter(v => !!v)).subscribe(model => this.downloadModel(model));
    }

    private downloadModel(model: ModelDownload){
        // TODO: Download model
    }

    public addModelToDownload(model: ModelDownload): ModelDownload{
        const queue = this.queue$.value;
        queue.push(model);
        this.queue$.next(queue);
        return model;
    }

    public removeFromDownloadQueue(model: ModelDownload){
        const queue = this.queue$.value;
        const index = queue.findIndex(m => m.hash === model.hash);
        
        if(index === -1){ return; }
        
        queue.splice(index, 1);
        this.queue$.next(queue);
    }

    public onModelsDownloaded$(cb: (model: ModelDownload) => void): Subscription{
        return this.lastDownloadedModel$.pipe(filter(v => !!v)).subscribe(cb);
    }

    public isDownloading$(model: ModelDownload): Observable<boolean>{
        return this._currentDownload$.pipe(map(current => {
            if(!current){ return false; }
            return current.hash === model.hash && current.version === model.version
        }), distinctUntilChanged());
    }

    public currentDownload$(): Observable<ModelDownload>{
        return this._currentDownload$;
    }

    public isPending$(model: ModelDownload): Observable<boolean>{
        return this.queue$.pipe(map(queue => queue.at(0).hash !== model.hash && queue.at(0).version !== model.version && queue.some(m => m.hash === model.hash && m.version === model.version)), distinctUntilChanged());
    }

    public openDownloadModelsModal(version: BSVersion, type?: MSModelType): Promise<ModalResponse<void>>{
        return this.modal.openModal(DownloadModelsModal, {version, type}); // TODO MODELS
    }

}

export type ModelDownload = Partial<MSModel> & Pick<MSModel, "hash"> & {version: BSVersion};
export type ModelDownloaded = BsmLocalModel & {version: BSVersion};