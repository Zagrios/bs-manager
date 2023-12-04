import path from "path";
import { Observable, lastValueFrom, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BSLocalVersionService } from "../bs-local-version.service";
import { DeepLinkService } from "../deep-link.service";
import { RequestService } from "../request.service";
import { LocalMapsManagerService } from "./local-maps-manager.service";
import log from "electron-log";
import { WindowManagerService } from "../window-manager.service";
import { BPList, DownloadPlaylistProgressionData } from "shared/models/playlists/playlist.interface";
import { readFileSync } from "fs";
import { BeatSaverService } from "../thrid-party/beat-saver/beat-saver.service";
import { copy, copyFile, pathExists, realpath } from "fs-extra";
import { Progression, ensureFolderExist, pathExist } from "../../helpers/fs.helpers";
import { IpcService } from "../ipc.service";

export class LocalPlaylistsManagerService {
    private static instance: LocalPlaylistsManagerService;

    public static getInstance(): LocalPlaylistsManagerService {
        if (!LocalPlaylistsManagerService.instance) {
            LocalPlaylistsManagerService.instance = new LocalPlaylistsManagerService();
        }
        return LocalPlaylistsManagerService.instance;
    }

    private readonly PLAYLISTS_FOLDER = "Playlists";
    private readonly DEEP_LINKS = {
        BeatSaver: "bsplaylist",
    };

    private readonly versions: BSLocalVersionService;
    private readonly maps: LocalMapsManagerService;
    private readonly request: RequestService;
    private readonly deepLink: DeepLinkService;
    private readonly windows: WindowManagerService;
    private readonly bsaver: BeatSaverService;
    private readonly ipc: IpcService;

    private constructor() {
        this.maps = LocalMapsManagerService.getInstance();
        this.versions = BSLocalVersionService.getInstance();
        this.request = RequestService.getInstance();
        this.deepLink = DeepLinkService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.bsaver = BeatSaverService.getInstance();
        this.ipc = IpcService.getInstance();

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.BeatSaver, link => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.BeatSaver, link);
            const url = new URL(link);
            const bplistUrl = url.host === "playlist" ? url.pathname.replace("/", "") : "";
            this.openOneClickDownloadPlaylistWindow(bplistUrl);
        });
    }

    private async getPlaylistsFolder(version?: BSVersion) {
        if (!version) {
            throw "Playlists are not available to be linked yet";
        }

        const versionFolder = await this.versions.getVersionPath(version);

        const folder = path.join(versionFolder, this.PLAYLISTS_FOLDER);

        await ensureFolderExist(folder);

        return folder;
    }

    private async installBPListFile(bslistSource: string, version: BSVersion): Promise<string> {
        const playlistFolder = await this.getPlaylistsFolder(version);
        const isLocalFile = await pathExists(bslistSource).catch(e => { log.error(e); return false; });
        const filename = isLocalFile ? path.basename(bslistSource) :  new URL(bslistSource).pathname.split('/').pop()
        const destFile = path.join(playlistFolder, filename);

        if (isLocalFile) {
            return copyFile(bslistSource, destFile).then(() => destFile);
        }
        return lastValueFrom(this.request.downloadFile(bslistSource, destFile)).then(res => res.data);
    }
        

    private async readPlaylistFile(path: string): Promise<BPList> {
        if (!(await pathExist(path))) {
            throw `bplist file not exist at ${path}`;
        }

        const rawContent = readFileSync(path).toString();

        return JSON.parse(rawContent);
    }

    private openOneClickDownloadPlaylistWindow(downloadUrl: string): void {
        this.windows.openWindow(`oneclick-download-playlist.html?playlistUrl=${downloadUrl}`);
    }

    public downloadPlaylist(bpListUrl: string, version: BSVersion): Observable<Progression<DownloadPlaylistProgressionData>> {

        return new Observable<Progression<DownloadPlaylistProgressionData>>(obs => {
            (async () => {

                const bpListFilePath = await this.installBPListFile(bpListUrl, version);
                const bpList = await this.readPlaylistFile(bpListFilePath);
                
                const progress: Progression<DownloadPlaylistProgressionData> = { 
                    total: bpList.songs.length,
                    current: 0,
                    data: {
                        downloadedMaps: [],
                        currentDownload: null,
                        playlistInfos: bpList,
                        playlistPath: bpListFilePath,
                    }
                };

                obs.next(progress);

                for (const song of bpList.songs) {
                    const [ mapDetail ] = await this.bsaver.getMapDetailsFromHashs([song.hash]);

                    if(!mapDetail) {
                        continue;
                    }

                    const downloadedMap = await this.maps.downloadMap(mapDetail, version);

                    progress.data.downloadedMaps.push(downloadedMap);
                    progress.data.currentDownload = mapDetail;
                    progress.current += 1;
                    obs.next(progress);
                }

            })()
            .catch(err => obs.error(err))
            .finally(() => obs.complete());
        });

    }

    public oneClickInstallPlaylist(bpListUrl: string): Observable<Progression<DownloadPlaylistProgressionData>> {

        return new Observable<Progression<DownloadPlaylistProgressionData>>(obs => {
            (async () => {
                const versions = await this.versions.getInstalledVersions();

                const download$ = this.downloadPlaylist(bpListUrl, versions.pop()).pipe(tap({
                    next: progress => obs.next(progress),
                    error: err => obs.error(err),
                }));

                const { data: {downloadedMaps, playlistPath} } = await lastValueFrom(download$);

                if(downloadedMaps?.length === 0 || !playlistPath) { return; }

                const realSourceMapsFolder = await realpath(path.dirname(downloadedMaps[0].path));

                for (const version of versions) {
                    await this.installBPListFile(playlistPath, version);

                    const versionMapsFolder = await this.maps.getMapsFolderPath(version);
                    const realDestMapsFolder = await realpath(versionMapsFolder).catch(e => {
                        log.error(e);
                        return versionMapsFolder;
                    });

                    if(realSourceMapsFolder === realDestMapsFolder) { continue; }

                    for (const mapPath of downloadedMaps) {
                        const mapDest = path.join(versionMapsFolder, path.basename(mapPath.path));
                        await copy(mapPath.path, mapDest, { overwrite: true });
                    }
                }

            })()
            .catch(err => obs.error(err))
            .finally(() => obs.complete());
        });
    }

    public enableDeepLinks(): boolean {
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.registerDeepLink(link));
    }

    public disableDeepLinks(): boolean {
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.unRegisterDeepLink(link));
    }

    public isDeepLinksEnabled(): boolean {
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.isDeepLinkRegistered(link));
    }
}
