import { BehaviorSubject, Observable, filter, lastValueFrom, map, shareReplay, take, tap } from "rxjs";
import { BPList, DownloadPlaylistProgressionData } from "shared/models/playlists/playlist.interface";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { Progression } from "main/helpers/fs.helpers";
import equal from "fast-deep-equal";
import { BSVersion } from "shared/bs-version.interface";

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

    private readonly playlistQueue$ = new BehaviorSubject<BPList[]>([]);

    private constructor() {
        this.progress = ProgressBarService.getInstance();
        this.ipc = IpcService.getInstance();
    }

    public installPlaylist(bpList: BPList, version?: BSVersion): Observable<Progression<DownloadPlaylistProgressionData>> {
        this.playlistQueue$.next([...this.playlistQueue$.value, bpList]);

        const clear = () => {
            this.playlistQueue$.next(this.playlistQueue$.value.filter(p => p !== bpList));
        }

        return new Observable<Progression<DownloadPlaylistProgressionData>>(subscriber => {
            (async () => {
                const playlist = await lastValueFrom(this.playlistQueue$.pipe(map(queue => queue.at(0)), filter(p => equal(bpList, p)), take(1)));
                const download$ = this.ipc.sendV2<Progression<DownloadPlaylistProgressionData>, unknown>("install-playlist", { args: { version, playlist } });

                await lastValueFrom(download$.pipe(tap(subscriber)));
            })()
            .then(() => subscriber.complete())
            .catch(err => subscriber.error(err))
            .finally(clear);

        }).pipe(shareReplay(1))
    }

    public oneClickInstallPlaylist(bpListUrl: string): Observable<Progression<DownloadPlaylistProgressionData>> {

        const download$ = this.ipc.sendV2<Progression<DownloadPlaylistProgressionData>, string>("one-click-install-playlist", { args: bpListUrl });
        const progress$ = download$.pipe(map(data => (data.current / data.total) * 100));

        this.progress.show(progress$, true);

        return download$.pipe(tap({
            error: () => this.progress.hide(true),
            complete: () => this.progress.hide(true)
        }));
    }
}
