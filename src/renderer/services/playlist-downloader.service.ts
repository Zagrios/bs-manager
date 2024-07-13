import { BehaviorSubject, Observable, Subject, Subscription, distinctUntilChanged, filter, lastValueFrom, map, shareReplay, take, takeUntil, tap } from "rxjs";
import { BPList, DownloadPlaylistProgressionData } from "shared/models/playlists/playlist.interface";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { Progression } from "main/helpers/fs.helpers";
import equal from "fast-deep-equal";
import { BSVersion } from "shared/bs-version.interface";
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { removeIndex } from "shared/helpers/array.helpers";
import { ModalResponse, ModalService } from "./modale.service";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { DownloadPlaylistModal } from "renderer/components/modal/modal-types/playlist/download-playlist-modal/download-playlist-modal.component";
import { IpcRequestType } from "shared/models/ipc/ipc-routes";

export class PlaylistDownloaderService {
    private static instance: PlaylistDownloaderService;

    public static getInstance(): PlaylistDownloaderService {
        if (!PlaylistDownloaderService.instance) {
            PlaylistDownloaderService.instance = new PlaylistDownloaderService();
        }
        return PlaylistDownloaderService.instance;
    }


    private readonly progress: ProgressBarService;
    private readonly ipc: IpcService;
    private readonly modal: ModalService;

    private readonly cancel$ = new Subject<void>();
    private readonly downloadQueue$ = new BehaviorSubject<PlaylistQueueInfo[]>([]);
    private readonly _currentDownload$ = new BehaviorSubject<PlaylistQueueInfo>(null);

    private constructor() {
        this.progress = ProgressBarService.getInstance();
        this.ipc = IpcService.getInstance();
        this.modal = ModalService.getInstance();
    }

    public downloadPlaylist(info: IpcRequestType<"download-playlist">): Observable<Progression<DownloadPlaylistProgressionData>> {

        this.downloadQueue$.next([...this.downloadQueue$.value, { info }]);

        return new Observable<Progression<DownloadPlaylistProgressionData>>(subscriber => {

            const subs: Subscription[] = [];
            let canShowProgress = false;

            (async () => {
                const queueInfo = await lastValueFrom(this.downloadQueue$.pipe(map(queue => queue.at(0)), filter(qInfo => equal(info.downloadSource, qInfo.info.downloadSource) && equal(info.version, qInfo.info.version)), take(1)));

                const download$ = this.ipc.sendV2("download-playlist", info).pipe(takeUntil(this.cancel$));

                subs.push(download$.pipe(map(progress => progress?.data?.playlist), filter(Boolean), take(1)).subscribe(playlist => {
                    this._currentDownload$.next({ ...queueInfo, downloaded: playlist });
                }));

                canShowProgress = !this.progress.isVisible;
                if (canShowProgress) {
                    this.progress.show(download$, true);
                }

                await lastValueFrom(download$.pipe(tap(subscriber)));
            })()
            .then(() => subscriber.complete())
            .catch(err => subscriber.error(err))
            .finally(() => {
                this._currentDownload$.next(null);
                this.downloadQueue$.next(this.downloadQueue$.value.filter(qInfo => !equal(qInfo.info.version, info.version) || !equal(qInfo.info.downloadSource, info.downloadSource)));
                if (canShowProgress) {
                    this.progress.hide(true);
                }
            });

            return () => subs.forEach(s => s.unsubscribe());

        }).pipe(shareReplay(1));
    }

    public cancelDownload(downloadSource: string, version?: BSVersion) {
        const currentDownload = this.downloadQueue$.value.at(0);
        if(!currentDownload) { return; }

        if(equal(currentDownload.info.downloadSource, downloadSource) && equal(currentDownload.info.version, version)){
            return this.cancel$.next();
        }

        const indexToRemove = this.downloadQueue$.value.findIndex(qInfo => (equal(qInfo.info.downloadSource, downloadSource) && equal(qInfo.info.version, version)));
        if(indexToRemove === -1){ return; }


        const newArr = removeIndex(indexToRemove, [...this.downloadQueue$.value]);
        this.downloadQueue$.next(newArr);
    }

    public get currentDownload$(): Observable<PlaylistQueueInfo> {
        return this._currentDownload$.asObservable();
    }

    public $isPlaylistInQueue(downloadSource: string, version?: BSVersion): Observable<boolean> {
        return this.downloadQueue$.pipe(map(queue => queue.some(qInfo => qInfo && (equal(qInfo.info.downloadSource, downloadSource) && equal(qInfo.info.version, version))), distinctUntilChanged()));
    }

    public $isPlaylistDownloading(downloadSource: string, version?: BSVersion): Observable<boolean> {
        return this.currentDownload$.pipe(map(qInfo => {
            if(!qInfo){ return false; }
            if(!equal(qInfo.info.downloadSource, downloadSource)){ return false; }
            if(version && !equal(qInfo.info.version, version)){ return false; }
            return true;
        }), distinctUntilChanged());
    }

    public oneClickInstallPlaylist(bpListUrl: string): Observable<Progression<DownloadPlaylistProgressionData>> {

        const download$ = this.ipc.sendV2("one-click-install-playlist", bpListUrl);
        const progress$ = download$.pipe(map(data => (data.current / data.total) * 100));

        this.progress.show(progress$, true);

        return download$.pipe(tap({
            error: () => this.progress.hide(true),
            complete: () => this.progress.hide(true)
        }));
    }

    public openDownloadPlaylistModal(version: BSVersion, ownedPlaylists$: Observable<LocalBPListsDetails[]>, ownedMaps$: Observable<BsmLocalMap[]>): Promise<ModalResponse<void>> {
        return this.modal.openModal(DownloadPlaylistModal, { data: { version, ownedPlaylists$, ownedMaps$ } })
    }

    public installPlaylistFile(bplist: BPList, version?: BSVersion, dest?: string){
        return this.ipc.sendV2("install-playlist-file", { bplist, version, dest });
    }
}

export type PlaylistQueueInfo = {
    info: Omit<IpcRequestType<"download-playlist">, "ignoreSongsHashs">;
    downloaded?: LocalBPListsDetails;
}
