import { BSVersion } from "shared/bs-version.interface";
import { IpcService } from "./ipc.service";
import { Observable, Subject, Subscription, catchError, distinctUntilChanged, filter, lastValueFrom, map, of } from "rxjs";
import { FolderLinkState, VersionFolderLinkerService } from "./version-folder-linker.service";
import { Progression } from "main/helpers/fs.helpers";
import { LocalBPList, LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { ModalExitCode, ModalService } from "./modale.service";
import { UnlinkPlaylistModal } from "renderer/components/modal/modal-types/unlink-playlist-modal.component";
import { LinkPlaylistModal } from "renderer/components/modal/modal-types/link-playlist-modal.component";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { ProgressBarService } from "./progress-bar.service";
import equal from "fast-deep-equal";
import { noop } from "shared/helpers/function.helpers";
import { NotificationService } from "./notification.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";

export class PlaylistsManagerService {
    private static instance: PlaylistsManagerService;

    public static getInstance(): PlaylistsManagerService {
        if (!PlaylistsManagerService.instance) {
            PlaylistsManagerService.instance = new PlaylistsManagerService();
        }
        return PlaylistsManagerService.instance;
    }

    public static readonly RELATIVE_PLAYLISTS_FOLDER = "Playlists";

    private readonly lastPlaylistImported$ = new Subject<{ version: BSVersion, playlist: LocalBPListsDetails }>();

    private readonly ipc: IpcService;
    private readonly linker: VersionFolderLinkerService;
    private readonly modal: ModalService;
    private readonly progressBar: ProgressBarService;
    private readonly notification: NotificationService;

    private constructor() {
        this.ipc = IpcService.getInstance();
        this.linker = VersionFolderLinkerService.getInstance();
        this.modal = ModalService.getInstance();
        this.progressBar = ProgressBarService.getInstance();
        this.notification = NotificationService.getInstance();
    }

    public getVersionPlaylistsDetails(version: BSVersion): Observable<Progression<LocalBPListsDetails[]>> {
        return this.ipc.sendV2("get-version-playlists-details", version);
    }

    public deletePlaylist(opt: {version: BSVersion, bpList: LocalBPList, deleteMaps?: boolean}): Observable<Progression> {
        return this.ipc.sendV2("delete-playlist", opt);
    }

    public exportPlaylists(opt: {version: BSVersion, bpLists: LocalBPList[], dest: string, playlistsMaps?: BsmLocalMap[]}): Observable<Progression<string>> {
        return this.ipc.sendV2("export-playlists", {
            version: opt.version,
            bpLists: opt.bpLists,
            dest: opt.dest,
            playlistsMaps: opt.playlistsMaps
        });
    }

    public importPlaylists(opt: { version?: BSVersion, paths: string[] }): Observable<Progression<LocalBPListsDetails>> {
        return new Observable<Progression<LocalBPListsDetails>>(obs => {
            if(!this.progressBar.require()){
                obs.error("A progression is already running");
                return noop;
            }

            const subs: Subscription[] = [];

            const import$ = this.ipc.sendV2("import-playlists", opt);
            subs.push(import$.subscribe(obs));

            subs.push(import$.pipe(catchError(() => of()), map(progress => progress?.data), filter(Boolean), distinctUntilChanged((a, b) => equal(a, b))).subscribe({
                next: playlist => {
                    this.lastPlaylistImported$.next({ version: opt.version, playlist });
                }
            }));

            this.progressBar.show(import$);

            const knownErrors = ["INVALID_SOURCE", "INVALID_PLAYLIST_FILE", "CANNOT_PARSE_PLAYLIST"];

            lastValueFrom(import$).then(res => {
                if(res.lastError && !res.current){
                    throw res.lastError;
                }

                if(!res.total){
                    return this.notification.notifyWarning({
                        title: "playlist.no-playlist-found",
                        desc: "playlist.no-playlist-found-in-selected-files"
                    });
                }

                if(res.current < res.total){
                    return this.notification.notifyWarning({
                        title: "playlist.some-playlists-not-imported",
                        desc: knownErrors.includes(res.lastError?.code) ? `playlist.some-playlists-have-been-imported.${res.lastError.code}` : "playlist.some-playlists-have-been-imported.unknown"
                    });
                }

                return this.notification.notifySuccess({
                    title: "playlist.playlists-imported",
                    desc: "playlist.all-playlists-have-been-successfully-imported",
                });
            }).catch((err: CustomError) => {
                this.notification.notifyError({
                    title: "playlist.no-playlists-imported",
                    desc: knownErrors.includes(err.code) ? `playlist.no-playlists-imported-errors.${err.code}` : "playlist.no-playlists-imported-errors.unknown"
                });
            }).finally(() => {
                obs.complete();
            })


            return () => {
                subs.forEach(s => s.unsubscribe());
                this.progressBar.hide();
            }

        });
    }

    public async linkVersion(version: BSVersion): Promise<boolean> {
        const modalRes = await this.modal.openModal(LinkPlaylistModal);

        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return Promise.resolve(false);
        }

        return this.linker.linkVersionFolder({
            version,
            relativeFolder: PlaylistsManagerService.RELATIVE_PLAYLISTS_FOLDER,
            options: { keepContents: !!modalRes.data },
        });
    }

    public async unlinkVersion(version: BSVersion): Promise<boolean> {
        const modalRes = await this.modal.openModal(UnlinkPlaylistModal);

        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return Promise.resolve(false);
        }

        return this.linker.unlinkVersionFolder({
            version,
            relativeFolder: PlaylistsManagerService.RELATIVE_PLAYLISTS_FOLDER,
            options: { keepContents: !!modalRes.data },
        });
    }

    public isDeepLinksEnabled(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2("is-playlists-deep-links-enabled"));
    }

    public enableDeepLink(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2("register-playlists-deep-link"));
    }

    public disableDeepLink(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2("unregister-playlists-deep-link"));
    }

    public $playlistsFolderLinkState(version: BSVersion): Observable<FolderLinkState> {
        return this.linker.$folderLinkedState(version, PlaylistsManagerService.RELATIVE_PLAYLISTS_FOLDER);
    }

    public $onPlaylistImported(version?: BSVersion): Observable<LocalBPListsDetails> {
        return this.lastPlaylistImported$.pipe(
            filter((val) => val?.playlist && equal(val.version, version)),
            map((val) => val.playlist)
        );
    }
}
