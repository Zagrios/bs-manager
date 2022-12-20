import path from "path";
import { BehaviorSubject } from "rxjs";
import { Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsvPlaylist, BsvPlaylistPage } from "shared/models/maps/beat-saver.model";
import { BSLocalVersionService } from "../bs-local-version.service";
import { RequestService } from "../request.service";
import { UtilsService } from "../utils.service";
import { LocalMapsManagerService } from "./local-maps-manager.service";

export class LocalPlaylistsManagerService {

    private static instance: LocalPlaylistsManagerService

    public static getInstance(): LocalPlaylistsManagerService {
        if (!LocalPlaylistsManagerService.instance) { LocalPlaylistsManagerService.instance = new LocalPlaylistsManagerService(); }
        return LocalPlaylistsManagerService.instance;
    }

    private readonly PLAYLISTS_FOLDER = "Playlists";
    private readonly DEEP_LINKS = {
        BeatSaver: "bsplaylist",
    };


    private readonly versions: BSLocalVersionService;
    private readonly maps: LocalMapsManagerService;
    public readonly utils: UtilsService;
    public readonly request: RequestService;

    private constructor(){
        this.maps = LocalMapsManagerService.getInstance();
        this.versions = BSLocalVersionService.getInstance();
        this.utils = UtilsService.getInstance();
        this.request = RequestService.getInstance();
    }

    private getPlaylistIdFromDownloadUrl(url: string): string{
        const splited = url.split("/")
        const idIndex = splited.indexOf("id");
        return splited[idIndex + 1];
    }

    private async downloadPlaylistFile(playlist: BsvPlaylist, version: BSVersion): Promise<string>{

        const versionFolder = await this.versions.getVersionPath(version);
        const bpListUrl = playlist.downloadURL;

        const bsListDest = path.join(versionFolder, this.PLAYLISTS_FOLDER, path.basename(bpListUrl));

        return this.request.downloadFile(bpListUrl, bsListDest);

    }

    public downloadPlaylist(playlistPage: BsvPlaylistPage, version: BSVersion): Observable<string[]>{

        const res = new BehaviorSubject<string[]>([]);

        const observer = async () => {
            try{
                const bpListPath = await this.downloadPlaylistFile(playlistPage.playlist, version);

                for(const map of playlistPage.maps){
                    const mapPath = await this.maps.downloadMap(map.map, version);
                    res.next([...res.value, mapPath]);
                }

                res.next([...res.value, bpListPath]);
                res.complete();
            }
            catch(e){
                res.error(e);
            }
        }

        observer();
        return res.asObservable();

    }

}