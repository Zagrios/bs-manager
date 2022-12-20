import path from "path";
import { BehaviorSubject, Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsvPlaylist, BsvPlaylistPage } from "shared/models/maps/beat-saver.model";
import { BSLocalVersionService } from "../bs-local-version.service";
import { DeepLinkService } from "../deep-link.service";
import { RequestService } from "../request.service";
import { UtilsService } from "../utils.service";
import { LocalMapsManagerService } from "./local-maps-manager.service";
import log from "electron-log"
import { isValidUrl } from "../../helpers/url.helpers";
import { ipcMain } from "electron";
import { WindowManagerService } from "../window-manager.service";
import { IpcRequest } from "shared/models/ipc";
import { BPList } from "shared/models/playlists/playlist.interface";
import { readFileSync } from "fs";

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
    private readonly utils: UtilsService;
    private readonly request: RequestService;
    private readonly deepLink: DeepLinkService;
    private readonly windows: WindowManagerService;

    private constructor(){
        this.maps = LocalMapsManagerService.getInstance();
        this.versions = BSLocalVersionService.getInstance();
        this.utils = UtilsService.getInstance();
        this.request = RequestService.getInstance();
        this.deepLink = DeepLinkService.getInstance();
        this.windows = WindowManagerService.getInstance();

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.BeatSaver, link => {

            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.BeatSaver, link);
            const url = new URL(link);
            const bplistUrl = url.host === "playlist" ? url.pathname.replace("/", "") : "";

            this.openOneClickDownloadPlaylistWindow(bplistUrl);

        });

    }

    private getPlaylistIdFromDownloadUrl(url: string): string{

        if(!isValidUrl(url)){ return ""; }

        const splited = url.split("/")
        const idIndex = splited.indexOf("id");

        if(idIndex < 0){ return ""; }

        return splited[idIndex + 1];
    }

    private async downloadPlaylistFile(playlist: BsvPlaylist, version: BSVersion): Promise<string>{

        const versionFolder = await this.versions.getVersionPath(version);
        const bpListUrl = playlist.downloadURL;

        const bsListDest = path.join(versionFolder, this.PLAYLISTS_FOLDER, path.basename(bpListUrl));

        return this.request.downloadFile(bpListUrl, bsListDest);

    }

    private async readPlaylistFile(path: string): Promise<BPList>{
        
        if(!this.utils.pathExist(path)){ return null; }

        const content = readFileSync(path).toJSON();


        // TODO
    }

    private openOneClickDownloadPlaylistWindow(downloadUrl: string): void{

        ipcMain.on("one-click-playlist-info", async (event, req: IpcRequest<void>) => {
            this.utils.ipcSend(req.responceChannel, {success: true, data: {bpListUrl: downloadUrl, id: this.getPlaylistIdFromDownloadUrl(downloadUrl)}});
        });

        this.windows.openWindow("oneclick-download-playlist.html");

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