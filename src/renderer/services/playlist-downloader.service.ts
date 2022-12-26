import { map } from "rxjs/operators";
import { Observable, Subject } from "rxjs";
import { DownloadPlaylistProgression } from "shared/models/playlists/playlist.interface";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { ProgressionInterface } from "shared/models/progress-bar";

export class PlaylistDownloaderService{

    private static instance: PlaylistDownloaderService;

    public static getInstance(): PlaylistDownloaderService{
        if(!PlaylistDownloaderService.instance){ PlaylistDownloaderService.instance = new PlaylistDownloaderService(); }
        return PlaylistDownloaderService.instance;
    }

    private readonly progressWatcher$ = new Subject<DownloadPlaylistProgression>();

    private readonly progress: ProgressBarService;
    private readonly ipc: IpcService;

    private constructor(){
        this.progress = ProgressBarService.getInstance();
        this.ipc = IpcService.getInstance();

        this.ipc.watch<DownloadPlaylistProgression>("download-playlist-progress").pipe(map(val => val.data)).subscribe(progress => {
            this.progressWatcher$.next(progress);
        })
    }

    private get downloadProgression$(): Observable<ProgressionInterface>{
        return this.progressWatcher$.pipe(map(value => {
            return {progression: value?.progression ?? 0, label: value?.current?.name ?? ""};
        }));
    }

    public get progress$(): Observable<DownloadPlaylistProgression>{
        return this.progressWatcher$.asObservable();
    }

    public oneClickInstallPlaylist(bpListUrl: string): Observable<DownloadPlaylistProgression>{

        this.progressWatcher$.next(null);

        const res = new Subject<DownloadPlaylistProgression>();

        this.progress.show(this.downloadProgression$, true);

        const sub = this.progressWatcher$.subscribe(progress => {
            res.next(progress);
            if(progress.progression === 100){
                this.progress.showFake(0.08);
            }
        })

        this.ipc.send<void, string>("one-click-install-playlist", {args: bpListUrl}).then(oneClickRes => {
            sub.unsubscribe();
            this.progress.hide(true);
            this.progressWatcher$.next(null);
            if(!oneClickRes.success){
                return res.error(oneClickRes.error);
            }
            res.complete();
        })

        return res.asObservable();

    }

}