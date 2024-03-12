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
import { copy, copyFile, ensureDir, pathExists, pathExistsSync, readdirSync, realpath } from "fs-extra";
import { Progression, pathExist, unlinkPath } from "../../helpers/fs.helpers";
import { FileAssociationService } from "../file-association.service";
import { SongDetailsCacheService } from "./maps/song-details-cache.service";
import { sToMs } from "shared/helpers/time.helpers";
import { LocalBPList, LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { SongCacheService } from "./maps/song-cache.service";
import { InstallationLocationService } from "../installation-location.service";

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
    private readonly bsmFs: InstallationLocationService;

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
        this.bsmFs = InstallationLocationService.getInstance();


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
        const rootPath = version ? await this.versions.getVersionPath(version) : await this.bsmFs.sharedContentPath();
        const fullPath = path.join(rootPath, this.PLAYLISTS_FOLDER);

        await ensureDir(fullPath);

        return fullPath;
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

    private getLocalBPListsOfFolder(folerPath: string): Observable<Progression<LocalBPList[]>> {
        return new Observable<Progression<LocalBPList[]>>(obs => {

            const progress: Progression<LocalBPList[]> = { current: 0, total: 0, data: [] };
            const bpLists: LocalBPList[] = [];

            (async () => {

                if(!pathExistsSync(folerPath)) {
                    throw new Error(`Playlists folder not found ${folerPath}`);
                }

                const playlists = readdirSync(folerPath).filter(file => path.extname(file) === ".bplist");
                progress.total = playlists.length;

                for (const playlist of playlists) {
                    const playlistPath = path.join(folerPath, playlist);
                    const bpList = await this.readPlaylistFile(playlistPath);


                    const localBpList: LocalBPList = { ...bpList, path: playlistPath };
                    bpLists.push(localBpList);
                    progress.current += 1;
                    obs.next(progress);
                }

                progress.data = bpLists;
                obs.next(progress);
            })().catch(err => obs.error(err)).finally(() => obs.complete());
        });
    }

    public getVersionPlaylistsDetails(version: BSVersion): Observable<Progression<LocalBPListsDetails[]>> {

        return new Observable<Progression<LocalBPListsDetails[]>>(obs => {
            (async () => {

                const folder = await this.getPlaylistsFolder(version);
                const progress$ = this.getLocalBPListsOfFolder(folder);

                const localBPListsRes = (await lastValueFrom(progress$.pipe(tap({ next: progress => obs.next({...progress, data: []}) }))));

                await this.songDetails.waitLoaded(sToMs(15));

                const tryExtractPlaylistId = (url: string) => {
                    const regex = /\/id\/(\d+)\/download/;
                    const match = url.match(regex);
                    return match ? Number(match[1]) : undefined;
                }

                const bpListsDetails: LocalBPListsDetails[] = [];
                for(const bpList of localBPListsRes.data){

                    const bpListDetails: LocalBPListsDetails = {
                        ...bpList,
                        nbMaps: bpList.songs?.length ?? 0,
                        id: bpList.customData?.syncURL ? tryExtractPlaylistId(bpList.customData.syncURL) : undefined
                    }

                    const songsDetails = bpList.songs?.map(s => this.songDetails.getSongDetails(s.hash));

                    if(songsDetails){
                        bpListDetails.duration = songsDetails.reduce((acc, song) => acc + song.duration, 0);
                        bpListDetails.nbMappers = new Set(songsDetails.map(s => s.uploader.id)).size;
                        bpListDetails.minNps = Math.min(...songsDetails.map(s => Math.min(...s.difficulties.map(d => d.nps || 0))));
                        bpListDetails.maxNps = Math.max(...songsDetails.map(s => Math.max(...s.difficulties.map(d => d.nps || 0))));
                    }

                    bpListsDetails.push(bpListDetails);
                }

                obs.next({...localBPListsRes, data: bpListsDetails});

            })().catch(err => obs.error(err))
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

    public deletePlaylist(opt: {path: string, deleteMaps?: boolean}): Observable<Progression>{

        console.log("AAAAAA");

        return new Observable<Progression>(obs => {
            (async () => {

                const bpList = await this.readPlaylistFile(opt.path);

                const progress: Progression = { current: 0, total: opt.deleteMaps ? bpList.songs.length + 1 : 1};

                if(opt.deleteMaps){
                    const mapsHashs = bpList.songs.map(s => ({ hash: s.hash }));
                    await lastValueFrom(this.maps.deleteMaps(mapsHashs).pipe(
                        tap({
                            next: () => {
                                progress.current += 1
                                obs.next(progress);
                            },
                            error: err => obs.error(err),
                            complete: () => obs.next(progress),
                        }),
                    ));
                }

                await unlinkPath(opt.path);
                progress.current += 1;
                obs.next(progress);
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
