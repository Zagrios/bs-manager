import { BSVersion } from "shared/bs-version.interface";
import { IpcService } from "./ipc.service";
import { Observable, lastValueFrom } from "rxjs";
import { FolderLinkState, VersionFolderLinkerService } from "./version-folder-linker.service";
import { Progression } from "main/helpers/fs.helpers";
import { LocalBPList } from "shared/models/playlists/local-playlist.models";

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

    private constructor() {
        this.ipc = IpcService.getInstance();
        this.linker = VersionFolderLinkerService.getInstance();
    }

    public getVersionPlaylists(version: BSVersion): Observable<Progression<LocalBPList[]>> {
        return this.ipc.sendV2("get-version-playlists", { args: version });
    }

    public isDeepLinksEnabled(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2<boolean>("is-playlists-deep-links-enabled"));
    }

    public enableDeepLink(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2<boolean>("register-playlists-deep-link"));
    }

    public disableDeepLink(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2<boolean>("unregister-playlists-deep-link"));
    }

    public $playlistsFolderLinkState(version: BSVersion): Observable<FolderLinkState> {
        return this.linker.$folderLinkedState(version, PlaylistsManagerService.RELATIVE_PLAYLISTS_FOLDER);
    }
}
