import { BSVersion } from "shared/bs-version.interface";
import { IpcService } from "./ipc.service";
import { Observable, lastValueFrom } from "rxjs";
import { FolderLinkState, VersionFolderLinkerService } from "./version-folder-linker.service";
import { Progression } from "main/helpers/fs.helpers";
import { LocalBPList, LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { ModalExitCode, ModalService } from "./modale.service";
import { UnlinkPlaylistModal } from "renderer/components/modal/modal-types/unlink-playlist-modal.component";
import { LinkPlaylistModal } from "renderer/components/modal/modal-types/link-playlist-modal.component";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";

export class PlaylistsManagerService {
    private static instance: PlaylistsManagerService;

    public static getInstance(): PlaylistsManagerService {
        if (!PlaylistsManagerService.instance) {
            PlaylistsManagerService.instance = new PlaylistsManagerService();
        }
        return PlaylistsManagerService.instance;
    }

    public static readonly RELATIVE_PLAYLISTS_FOLDER = "Playlists";

    private readonly ipc: IpcService;
    private readonly linker: VersionFolderLinkerService;
    private readonly modal: ModalService;

    private constructor() {
        this.ipc = IpcService.getInstance();
        this.linker = VersionFolderLinkerService.getInstance();
        this.modal = ModalService.getInstance();
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
}
