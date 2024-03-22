import { BehaviorSubject, Observable, Subscription, distinctUntilChanged, filter, lastValueFrom, map, shareReplay, startWith, timer } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { MSModel, MSModelType } from "shared/models/models/model-saber.model";
import { ModalResponse, ModalService } from "../modale.service";
import { IpcService } from "../ipc.service";
import { DownloadModelsModal } from "renderer/components/modal/modal-types/models/download-models-modal.component";
import { ProgressBarService } from "../progress-bar.service";
import { ProgressionInterface } from "shared/models/progress-bar";
import equal from "fast-deep-equal";

export class ModelsDownloaderService {
    private static instance: ModelsDownloaderService;

    public static getInstance(): ModelsDownloaderService {
        if (!ModelsDownloaderService.instance) {
            ModelsDownloaderService.instance = new ModelsDownloaderService();
        }
        return ModelsDownloaderService.instance;
    }

    private readonly ipc: IpcService;
    private readonly modal: ModalService;
    private readonly progress: ProgressBarService;

    private readonly lastDownload$ = new BehaviorSubject<BsmLocalModel>(null);
    private readonly queue$ = new BehaviorSubject<ModelDownload[]>([]);
    private readonly _currentDownload$ = this.queue$.pipe(
        map(queue => queue.at(0)),
        distinctUntilChanged(),
        shareReplay(1)
    );

    private constructor() {
        this.ipc = IpcService.getInstance();
        this.modal = ModalService.getInstance();
        this.progress = ProgressBarService.getInstance();

        this._currentDownload$.pipe(filter(v => !!v)).subscribe(model => this.downloadModel(model));
        this._currentDownload$.pipe(filter(v => !v)).subscribe(() => this.lastDownload$.next(null));
    }

    private async downloadModel(download: ModelDownload) {
        const download$ = this.ipc.sendV2("download-model",  download);

        if (!this.progress.isVisible) {
            const progress$: Observable<ProgressionInterface> = download$.pipe(
                map(progress => {
                    return {
                        progression: progress.total ? (progress.current / progress.total) * 100 : 0,
                        label: download.model.name,
                    };
                }),
                startWith({ progression: 0.1, label: download.model.name })
            );
            this.progress.show(progress$, true);
        }

        const downloaded = await lastValueFrom(download$);
        this.lastDownload$.next(downloaded.data);

        this.progress.hide(true);

        this.queue$.next(this.queue$.value.filter(m => m.model.hash !== download.model.hash));
    }

    public addModelToDownload(model: ModelDownload): void {
        if (this.queue$.value.some(m => equal(m, model))) {
            return null;
        }
        const queue = this.queue$.value;
        queue.push(model);
        this.queue$.next([...queue]);
    }

    public removeFromDownloadQueue(download: ModelDownload) {
        const queue = this.queue$.value;
        const index = queue.findIndex(m => m.model.hash === download.model.hash);

        if (index === -1) {
            return;
        }

        queue.splice(index, 1);
        this.queue$.next([...queue]);
    }

    public onModelsDownloaded(cb: (model: BsmLocalModel) => void): Subscription {
        return this.lastDownload$.pipe(filter(download => !!download)).subscribe(cb);
    }

    public isDownloading$(download: ModelDownload): Observable<boolean> {
        return this._currentDownload$.pipe(
            map(current => {
                if (!current) {
                    return false;
                }
                return current.model.hash === download.model.hash && current.version === download.version;
            }),
            distinctUntilChanged()
        );
    }

    public currentDownload$(): Observable<ModelDownload> {
        return this._currentDownload$;
    }

    public isPending$(download: ModelDownload): Observable<boolean> {
        return this.queue$.pipe(
            map(queue => queue.at(0).model.hash !== download.model.hash && queue.at(0).version !== download.version && queue.some(d => d.model.hash === download.model.hash && d.version === download.version)),
            distinctUntilChanged()
        );
    }

    public getQueue$(): Observable<ModelDownload[]> {
        return this.queue$.asObservable();
    }

    public openDownloadModelsModal(version: BSVersion, type?: MSModelType, owned?: BsmLocalModel[]): Promise<ModalResponse<void>> {
        return this.modal.openModal(DownloadModelsModal, {data: { version, type, owned }});
    }

    public async oneClickInstallModel(model: MSModel): Promise<boolean> {
        this.progress.showFake(0.04);

        const res = await lastValueFrom(this.ipc.sendV2("one-click-install-model", model)).then(() => true).catch(() => false);

        this.progress.complete();
        await lastValueFrom(timer(500));
        this.progress.hide(true);

        return res;
    }
}

export type ModelDownload = {
    model: MSModel;
    version: BSVersion;
};
