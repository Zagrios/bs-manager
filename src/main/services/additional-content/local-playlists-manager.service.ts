import path from "path";
import { Observable, lastValueFrom, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BSLocalVersionService } from "../bs-local-version.service";
import { DeepLinkService } from "../deep-link.service";
import { RequestService } from "../request.service";
import { LocalMapsManagerService } from "./maps/local-maps-manager.service";
import log from "electron-log";
import { WindowManagerService } from "../window-manager.service";
import { BPList, DownloadPlaylistProgressionData } from "shared/models/playlists/playlist.interface";
import { readFileSync } from "fs";
import { BeatSaverService } from "../thrid-party/beat-saver/beat-saver.service";
import { copy, copyFile, pathExists, pathExistsSync, readdirSync, realpath } from "fs-extra";
import { Progression, ensureFolderExist, pathExist } from "../../helpers/fs.helpers";
import { FileAssociationService } from "../file-association.service";
import { SongDetailsCacheService } from "./maps/song-details-cache.service";
import { sToMs } from "shared/helpers/time.helpers";
import { LocalBPList, LocalBpListSong } from "shared/models/playlists/local-playlist.models";
import { SongCacheService } from "./maps/song-cache.service";
import { pathToFileURL } from "url";

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
    private readonly fileAssociation: FileAssociationService;
    private readonly windows: WindowManagerService;
    private readonly bsaver: BeatSaverService;
    private readonly songDetails: SongDetailsCacheService;
    private readonly songCache: SongCacheService;

    private constructor() {
        this.maps = LocalMapsManagerService.getInstance();
        this.versions = BSLocalVersionService.getInstance();
        this.request = RequestService.getInstance();
        this.deepLink = DeepLinkService.getInstance();
        this.fileAssociation = FileAssociationService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.bsaver = BeatSaverService.getInstance();
        this.songDetails = SongDetailsCacheService.getInstance();
        this.songCache = SongCacheService.getInstance();


        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.BeatSaver, link => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.BeatSaver, link);
            const url = new URL(link);
            const bplistUrl = url.host === "playlist" ? url.pathname.replace("/", "") : "";
            this.openOneClickDownloadPlaylistWindow(bplistUrl);
        });

        this.fileAssociation.registerFileAssociation(".bplist", filePath => {
            log.info("FILE ASSOCIATION RECEIVED", filePath);
            this.openOneClickDownloadPlaylistWindow(filePath);
        });
    }

    private async getPlaylistsFolder(version?: BSVersion) {
        if (!version) {
            throw new Error("Playlists are not available to be linked yet");
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


    private async readPlaylistFile(filePath: string): Promise<BPList> {
        if (!(await pathExist(filePath))) {
            throw new Error(`bplist file not exist at ${filePath}`);
        }

        const rawContent = readFileSync(filePath).toString();

        return JSON.parse(rawContent);
    }

    private openOneClickDownloadPlaylistWindow(downloadUrl: string): void {
        this.windows.openWindow(`oneclick-download-playlist.html?playlistUrl=${downloadUrl}`);
    }

    private readLocalBPListsOfFolder(folerPath: string, version?: BSVersion): Observable<Progression<LocalBPList[]>> {
        return new Observable<Progression<LocalBPList[]>>(obs => {

            const progress: Progression<LocalBPList[]> = { current: 0, total: 0, data: [] };
            const bpLists: LocalBPList[] = [];

            (async () => {

                await this.songDetails.waitLoaded(sToMs(15));

                if(!pathExistsSync(folerPath)) {
                    throw new Error(`Playlists folder not found ${folerPath}`);
                }

                const mapsFolder = version ? await this.maps.getMapsFolderPath(version) : null;
                const playlists = readdirSync(folerPath).filter(file => path.extname(file) === ".bplist");
                progress.total = playlists.length;

                for (const playlist of playlists) {
                    const playlistPath = path.join(folerPath, playlist);
                    const bpList = await this.readPlaylistFile(playlistPath);

                    const localBpListSongs = bpList.songs.map(song => {
                        const localInfos = mapsFolder ? this.songCache.getMapInfoFromHash(song.hash) : null;
                        const coverPath = localInfos ? path.join(mapsFolder, localInfos.path, localInfos.info.rawInfo._coverImageFilename) : null;
                        const songFilePath = localInfos ? path.join(mapsFolder, localInfos.path, localInfos.info.rawInfo._songFilename) : null;
                        return ({
                            song,
                            songDetails: this.songDetails.getSongDetails(song.hash),
                            coverUrl: (coverPath && pathExistsSync(coverPath)) ? pathToFileURL(coverPath).href : null,
                            songUrl: (songFilePath && pathExistsSync(songFilePath)) ? pathToFileURL(songFilePath).href : null,
                        } as LocalBpListSong)
                    });
                    const localBpList: LocalBPList = { ...bpList, path: playlistPath, songs: localBpListSongs };
                    bpLists.push(localBpList);
                    progress.current += 1;
                    obs.next(progress);
                }

                progress.data = bpLists;
                obs.next(progress);
            })().catch(err => obs.error(err)).finally(() => obs.complete());
        });
    }

    public getVersionPlaylists(version: BSVersion): Observable<Progression<LocalBPList[]>> {
        return new Observable<Progression<LocalBPList[]>>(obs => {
            this.getPlaylistsFolder(version)
                .then(folder => this.readLocalBPListsOfFolder(folder, version))
                .then(progress$ => lastValueFrom(progress$.pipe(
                    tap(progress => obs.next({...progress, data: []})),
                )))
                .then(res => obs.next(res))
                .catch(err => obs.error(err))
                .finally(() => obs.complete());
        });
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
