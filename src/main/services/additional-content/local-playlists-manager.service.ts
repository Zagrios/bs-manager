import path from "path";
import { BehaviorSubject, Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
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
import { BPList, DownloadPlaylistProgression } from "shared/models/playlists/playlist.interface";
import { copyFileSync, readFileSync } from "fs";
import { BeatSaverService } from "../thrid-party/beat-saver/beat-saver.service";
import { copySync } from "fs-extra";

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
    private readonly bsaver: BeatSaverService;

    private constructor(){
        this.maps = LocalMapsManagerService.getInstance();
        this.versions = BSLocalVersionService.getInstance();
        this.utils = UtilsService.getInstance();
        this.request = RequestService.getInstance();
        this.deepLink = DeepLinkService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.bsaver = BeatSaverService.getInstance();

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

    private async getPlaylistsFolder(version?: BSVersion){

        if(!version){ throw "Playlists are not available to be linked yet" }
        
        const versionFolder = await this.versions.getVersionPath(version);

        const folder =  path.join(versionFolder, this.PLAYLISTS_FOLDER);

        await this.utils.createFolderIfNotExist(folder)

        return folder;

    }

    private async installBPListFile(bpListUrlOrPath: string, version: BSVersion): Promise<string>{

        const playlistFolder = await this.getPlaylistsFolder(version);

        const bpListDest = path.join(playlistFolder, path.basename(bpListUrlOrPath)); 

        if(this.utils.pathExist(bpListUrlOrPath)){
            copyFileSync(bpListUrlOrPath, bpListDest);
        }
        else{
            await this.request.downloadFile(bpListUrlOrPath, bpListDest);
        }

        return bpListDest;

    }

    private async readPlaylistFile(path: string): Promise<BPList>{
        
        if(!this.utils.pathExist(path)){ throw `bplist file not exist at ${path}`; }

        const rawContent = readFileSync(path).toString();

        return JSON.parse(rawContent);

    }

    private openOneClickDownloadPlaylistWindow(downloadUrl: string): void{

        ipcMain.once("one-click-playlist-info", async (event, req: IpcRequest<void>) => {
            this.utils.ipcSend(req.responceChannel, {success: true, data: {bpListUrl: downloadUrl, id: this.getPlaylistIdFromDownloadUrl(downloadUrl)}});
        });

        this.windows.openWindow("oneclick-download-playlist.html");

    }

    public downloadPlaylist(bpListUrl: string, version: BSVersion): Observable<DownloadPlaylistProgression>{

        const res = new BehaviorSubject<DownloadPlaylistProgression>({progression: 0, current: null, downloadedMaps: [], mapsPath: [], bpListPath: ""});

        const sub = res.subscribe(process => {
            this.utils.ipcSend("download-playlist-progress", {success: true, data: process});
        }, err => {
            this.utils.ipcSend("download-playlist-progress", {success: false, error: err});
        });

        const observer = async () => {

            try{

                const bpListPath = await this.installBPListFile(bpListUrl, version);

                res.next({...res.value, bpListPath});

                const bpList = await this.readPlaylistFile(bpListPath);

                for(const song of bpList.songs){

                    if(!song.key){ continue; }

                    const map = await this.bsaver.getMapDetailsById(song.key);

                    res.next({
                        ...res.value,
                        current: map,
                        progression: ((res.value.downloadedMaps.length + .5) / bpList.songs.length) * 100
                    });

                    const mapPath = await this.maps.downloadMap(map, version);

                    const progression = ((res.value.downloadedMaps.length + 1) / bpList.songs.length) * 100;

                    res.next({
                        ...res.value,
                        current: null,
                        downloadedMaps: [...res.value.downloadedMaps, map],
                        mapsPath: [...res.value.mapsPath, mapPath.path],
                        progression
                    });

                }

            }
            catch(e){
                res.error(e);
            }

            res.complete();

        }

        observer().finally(() => sub.unsubscribe());
        return res.asObservable();

    }

    public async oneClickInstallPlaylist(bpListUrl: string): Promise<void>{

        const versions = await this.versions.getInstalledVersions();

        const firstVersion = versions.shift();
        const fistVersionLinked = await this.maps.versionIsLinked(firstVersion);

        const {bpListPath, mapsPath} = await this.downloadPlaylist(bpListUrl, firstVersion).toPromise();

        for(const version of versions){
            
            await this.installBPListFile(bpListPath, version);

            const versionIsLinked = await this.maps.versionIsLinked(version);

            if(fistVersionLinked && versionIsLinked){ continue; }

            for(const mapPath of mapsPath){
                const versionMapsFolder = await this.maps.getMapsFolderPath(version);
                const mapDest = path.join(versionMapsFolder, path.basename(mapPath));

                copySync(mapPath, mapDest, {overwrite: true});
            }

        }

    }

    public enableDeepLinks(): boolean{
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.registerDeepLink(link));
    }

    public disableDeepLinks(): boolean{
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.unRegisterDeepLink(link));
    }

    public isDeepLinksEnabled(): boolean{
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.isDeepLinkRegistred(link));
    }

}