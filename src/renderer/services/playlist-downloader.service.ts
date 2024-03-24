import { BehaviorSubject, Observable, Subscription, distinctUntilChanged, filter, lastValueFrom, map, shareReplay, take, takeUntil, takeWhile, tap } from "rxjs";
import { BPList, DownloadPlaylistProgressionData } from "shared/models/playlists/playlist.interface";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { Progression } from "main/helpers/fs.helpers";
import equal from "fast-deep-equal";
import { BSVersion } from "shared/bs-version.interface";
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";

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

    private readonly canceled$ = new BehaviorSubject<boolean>(false);
    private readonly playlistQueue$ = new BehaviorSubject<PlaylistQueueInfo[]>([]);
    private readonly onPlaylistDownloadedListeners = new Map<BSVersion, ((playlist: LocalBPListsDetails) => void)[]>();

    private constructor() {
        this.progress = ProgressBarService.getInstance();
        this.ipc = IpcService.getInstance();
    }

    public installPlaylist(bpList: BPList, version?: BSVersion, ignoreSongsHashs?: string[]): Observable<Progression<DownloadPlaylistProgressionData>> {

        this.playlistQueue$.next([...this.playlistQueue$.value, { version, source: bpList }]);

        console.log("AAAAA");

        return new Observable<Progression<DownloadPlaylistProgressionData>>(subscriber => {

            let subs: Subscription[] = [];

            (async () => {
                const queueInfo = await lastValueFrom(this.playlistQueue$.pipe(map(queue => queue.at(0)), filter(p => equal(bpList, p.source)), take(1)));

                console.log(queueInfo);

                const download$ = this.ipc.sendV2("install-playlist", { version: queueInfo.version, playlist: queueInfo.source, ignoreSongsHashs }).pipe(takeWhile(() => !this.canceled$.value));

                subs.push(download$.pipe(map(progress => progress?.data?.playlist), filter(Boolean), take(1)).subscribe(playlist => {
                    queueInfo.downloaded = playlist;
                    this.onPlaylistDownloadedListeners.get(version)?.forEach(cb => cb(playlist));
                }));

                const canShowProgress = !this.progress.isVisible;
                if (canShowProgress) {
                    this.progress.show(download$.pipe(map(data => (data.current / data.total) * 100)), true);
                }

                await lastValueFrom(download$.pipe(tap(subscriber))).finally(() => {
                    if (canShowProgress) {
                        this.progress.hide(true);
                    }
                })
            })()
            .then(() => subscriber.complete())
            .catch(err => subscriber.error(err))
            .finally(() => {
                this.playlistQueue$.next(this.playlistQueue$.value.filter(p => !equal(p.version, version) || !equal(p.source, bpList)));
                this.canceled$.next(false);
            });

            return () => subs.forEach(s => s.unsubscribe());

        }).pipe(shareReplay(1));
    }

    public cancelCurrentDownload() {
        this.canceled$.next(true);
    }

    public get currentDownloading$(): Observable<PlaylistQueueInfo> {
        return this.playlistQueue$.pipe(map(queue => queue.at(0)), distinctUntilChanged(equal));
    }

    public $isPlaylistInQueue(bpList: BPList, version?: BSVersion): Observable<boolean> {
        return this.playlistQueue$.pipe(map(queue => queue.some(p => p && (equal(p.source, bpList) || equal(p.downloaded, bpList)) && equal(p.version, version))), distinctUntilChanged());
    }

    public $isPlaylistDownloading(bpList: BPList, version?: BSVersion): Observable<boolean> {
        return this.currentDownloading$.pipe(map(p => p && (equal(p.source, bpList) || equal(p.downloaded, bpList)) && equal(p.version, version)), distinctUntilChanged());
    }

    public addOnPlaylistDownloadedListener(version: BSVersion, cb: (playlist: LocalBPListsDetails) => void){
        this.onPlaylistDownloadedListeners.set(version, [...(this.onPlaylistDownloadedListeners.get(version) || []), cb]);
    }

    public removeOnPlaylistDownloadedListener(version: BSVersion, cb: (playlist: LocalBPListsDetails) => void){
        this.onPlaylistDownloadedListeners.set(version, (this.onPlaylistDownloadedListeners.get(version) || []).filter(c => c !== cb));
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
}

export type PlaylistQueueInfo = {
    version?: BSVersion;
    source: BPList;
    downloaded?: LocalBPListsDetails;
}
