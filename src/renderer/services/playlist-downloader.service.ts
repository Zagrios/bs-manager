import { Observable, map, tap, throwError } from "rxjs";
import { DownloadPlaylistProgressionData } from "shared/models/playlists/playlist.interface";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { Progression } from "main/helpers/fs.helpers";

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

    private constructor() {
        this.progress = ProgressBarService.getInstance();
        this.ipc = IpcService.getInstance();
    }

    public oneClickInstallPlaylist(bpListUrl: string): Observable<Progression<DownloadPlaylistProgressionData>> {

        if(!this.progress.require()){
            return throwError(() => new Error("Download already in progress"));
        }

        const download$ = this.ipc.sendV2<Progression<DownloadPlaylistProgressionData>, string>("one-click-install-playlist", { args: bpListUrl });
        const progress$ = download$.pipe(map(data => (data.current / data.total) * 100));

        this.progress.show(progress$, true);

        return download$.pipe(tap({
            error: () => this.progress.hide(true),
            complete: () => this.progress.hide(true)
        }));
    }
}
