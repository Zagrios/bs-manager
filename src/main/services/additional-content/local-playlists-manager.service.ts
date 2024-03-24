import path from "path";
import { Observable, Subject, from, lastValueFrom, mergeMap, take, takeUntil, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BSLocalVersionService } from "../bs-local-version.service";
import { DeepLinkService } from "../deep-link.service";
import { RequestService } from "../request.service";
import { LocalMapsManagerService } from "./maps/local-maps-manager.service";
import log from "electron-log";
import { WindowManagerService } from "../window-manager.service";
import { BPList, DownloadPlaylistProgressionData, PlaylistSong } from "shared/models/playlists/playlist.interface";
import { readFileSync } from "fs";
import { BeatSaverService } from "../thrid-party/beat-saver/beat-saver.service";
import { copy, copyFile, ensureDir, pathExists, pathExistsSync, readdirSync, realpath, writeFile, writeFileSync } from "fs-extra";
import { Progression, pathExist, unlinkPath } from "../../helpers/fs.helpers";
import { FileAssociationService } from "../file-association.service";
import { SongDetailsCacheService } from "./maps/song-details-cache.service";
import { sToMs } from "shared/helpers/time.helpers";
import { LocalBPList, LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { SongCacheService } from "./maps/song-cache.service";
import { InstallationLocationService } from "../installation-location.service";
import sanitize from "sanitize-filename";
import { isValidUrl } from "shared/helpers/url.helpers";

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
            this.windows.openWindow(`oneclick-download-playlist.html?playlistUrl=${bplistUrl}`);
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

    private async installBPListFile(opt: {
        bslistSource: string,
        version?: BSVersion,
        dest?: string
    }): Promise<{path: string, localBPList: LocalBPList}> {
        const bplist = await this.readPlaylistFromSource(opt.bslistSource);

        const dest = await (async () => {
            if(opt.dest && path.isAbsolute(opt.dest) && path.extname(opt.dest) === ".bplist") { return opt.dest; }
            const playlistFolder = await this.getPlaylistsFolder(opt.version);
            return path.join(playlistFolder, `${sanitize(bplist.playlistTitle)}.bplist`);
        })();

        writeFileSync(dest, JSON.stringify(bplist, null, 2));

        const localBPList: LocalBPList = { ...bplist, path: dest };

        return { path: dest, localBPList };
    }


    private async readPlaylistFromSource(source: string): Promise<BPList> {
        const isLocalFile = await pathExists(source).catch(e => { log.error(e); return false; });

        if(!isLocalFile && !isValidUrl(source)) {
            throw new Error(`Invalid source ${source}`);
        }

        const bpList = isLocalFile ? JSON.parse(readFileSync(source).toString()) : await this.request.getJSON<BPList>(source);

        return bpList;
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
                    const bpList = await this.readPlaylistFromSource(playlistPath);


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

    public getLocalBPListDetails(localBPList: LocalBPList): LocalBPListsDetails {

        const tryExtractPlaylistId = (url: string) => {
            const regex = /\/id\/(\d+)\/download/;
            const match = url.match(regex);
            return match ? Number(match[1]) : undefined;
        }

        const bpListDetails: LocalBPListsDetails = {
            ...localBPList,
            nbMaps: localBPList.songs?.length ?? 0,
            id: localBPList.customData?.syncURL ? tryExtractPlaylistId(localBPList.customData.syncURL) : undefined
        }

        const songsDetails = localBPList.songs?.map(s => this.songDetails.getSongDetails(s.hash));

        if(songsDetails){
            bpListDetails.duration = songsDetails.reduce((acc, song) => acc + song.duration, 0);
            bpListDetails.nbMappers = new Set(songsDetails.map(s => s.uploader.id)).size;
            bpListDetails.minNps = Math.min(...songsDetails.map(s => Math.min(...s.difficulties.map(d => d.nps || 0))));
            bpListDetails.maxNps = Math.max(...songsDetails.map(s => Math.max(...s.difficulties.map(d => d.nps || 0))));
        }

        return bpListDetails;
    }

    public getVersionPlaylistsDetails(version: BSVersion): Observable<Progression<LocalBPListsDetails[]>> {

        return new Observable<Progression<LocalBPListsDetails[]>>(obs => {
            (async () => {

                const folder = await this.getPlaylistsFolder(version);
                const progress$ = this.getLocalBPListsOfFolder(folder);

                const localBPListsRes = (await lastValueFrom(progress$.pipe(tap({ next: progress => obs.next({...progress, data: []}) }))));

                await this.songDetails.waitLoaded(sToMs(15));

                const bpListsDetails: LocalBPListsDetails[] = [];
                for(const bpList of localBPListsRes.data){
                    bpListsDetails.push(this.getLocalBPListDetails(bpList));
                }

                obs.next({...localBPListsRes, data: bpListsDetails});

            })().catch(err => obs.error(err))
                .finally(() => obs.complete());
        });
    }

    public downloadPlaylistSongs(localBPList: LocalBPList, ignoreSongsHashs: string[] = [], version: BSVersion): Observable<Progression<DownloadPlaylistProgressionData>> {

        let destroyed = false;

        return new Observable<Progression<DownloadPlaylistProgressionData>>(obs => {
            (async () => {
                const progress: Progression<DownloadPlaylistProgressionData> = {
                    total: localBPList.songs.length,
                    current: 0,
                    data: {
                        downloadedMaps: [],
                        currentDownload: null,
                        playlist: this.getLocalBPListDetails(localBPList),
                    }
                };

                obs.next(progress);

                for (const song of localBPList.songs) {

                    if(destroyed) { break; }

                    if(ignoreSongsHashs.includes(song.hash)) {
                        progress.current += 1;
                        obs.next(progress);
                        continue;
                    }

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

            return () => {
                destroyed = true;
            }
        });
    }

    public downloadPlaylist({ bpListUrl, version, ignoreSongsHashs = [], dest }: {
        bpListUrl: string,
        version?: BSVersion
        ignoreSongsHashs?: string[]
        dest?: string
    }): Observable<Progression<DownloadPlaylistProgressionData>> {

        const destroyed$ = new Subject<void>()

        return new Observable<Progression<DownloadPlaylistProgressionData>>(obs => {
            (async () => {

                const { localBPList } = await this.installBPListFile({ bslistSource: bpListUrl, version, dest });

                await lastValueFrom(this.downloadPlaylistSongs(localBPList, ignoreSongsHashs, version).pipe(
                    tap({ next: p => obs.next(p) }),
                    takeUntil(destroyed$),
                ));

            })()
            .catch(err => obs.error(err))
            .finally(() => obs.complete());

            return () => {
                destroyed$.next();
                destroyed$.complete();
            }
        });

    }

    public deletePlaylist(opt: {path: string, deleteMaps?: boolean}): Observable<Progression>{

        return new Observable<Progression>(obs => {
            (async () => {

                const bpList = await this.readPlaylistFromSource(opt.path);

                const progress: Progression = { current: 0, total: opt.deleteMaps ? bpList.songs.length + 1 : 1};

                if(opt.deleteMaps){
                    const mapsHashs = bpList.songs.map(s => ({ hash: s.hash }));
                    await lastValueFrom(this.maps.deleteMaps(mapsHashs).pipe(
                        tap({
                            next: () => {
                                progress.current += 1
                                obs.next(progress);
                            },
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

                const download$ = this.downloadPlaylist({ bpListUrl, version: versions.pop() }).pipe(tap({
                    next: progress => obs.next(progress),
                    error: err => obs.error(err),
                }));

                const { data: {downloadedMaps, playlist} } = await lastValueFrom(download$);

                if(downloadedMaps?.length === 0 || !playlist.path) { return; }

                const realSourceMapsFolder = await realpath(path.dirname(downloadedMaps[0].path));

                for (const version of versions) {
                    await this.installBPListFile({ bslistSource: playlist.path, version});

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
