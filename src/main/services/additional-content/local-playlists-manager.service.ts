import path from "path";
import { Observable, Subject, from, lastValueFrom, takeUntil, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BSLocalVersionService } from "../bs-local-version.service";
import { DeepLinkService } from "../deep-link.service";
import { RequestService } from "../request.service";
import { LocalMapsManagerService } from "./maps/local-maps-manager.service";
import log from "electron-log";
import { WindowManagerService } from "../window-manager.service";
import { BPList, DownloadPlaylistProgressionData, PlaylistSong } from "shared/models/playlists/playlist.interface";
import { readFileSync, Stats } from "fs";
import { BeatSaverService } from "../thrid-party/beat-saver/beat-saver.service";
import { copy, ensureDir, pathExists, pathExistsSync, realpath, writeFileSync } from "fs-extra";
import { Progression, deleteFile, getUniqueFileNamePath } from "../../helpers/fs.helpers";
import { FileAssociationService } from "../file-association.service";
import { SongDetailsCacheService } from "./maps/song-details-cache.service";
import { sToMs } from "shared/helpers/time.helpers";
import { LocalBPList, LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { InstallationLocationService } from "../installation-location.service";
import sanitize from "sanitize-filename";
import { isValidUrl } from "shared/helpers/url.helpers";
import { Archive } from "main/models/archive.class";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { tryit } from "shared/helpers/error.helpers";
import recursiveReadDir from "recursive-readdir";
import { BsvMapDetail, SongDetails } from "shared/models/maps";
import { findHashInString } from "shared/helpers/string.helpers";
import { serializeError } from "serialize-error";

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
    private readonly PLAYLIST_FILETYPES = [".bplist", ".json"];

    private readonly versions: BSLocalVersionService;
    private readonly maps: LocalMapsManagerService;
    private readonly request: RequestService;
    private readonly deepLink: DeepLinkService;
    private readonly fileAssociation: FileAssociationService;
    private readonly windows: WindowManagerService;
    private readonly bsaver: BeatSaverService;
    private readonly songDetails: SongDetailsCacheService;
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
        this.bsmFs = InstallationLocationService.getInstance();


        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.BeatSaver, link => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.BeatSaver, link);
            const url = new URL(link);
            const bplistUrl = url.host === "playlist" ? url.pathname.replace("/", "") + url.search : "";
            this.windows.openWindow(`oneclick-download-playlist.html?playlistUrl=${encodeURIComponent(bplistUrl)}`);
        });

        this.fileAssociation.registerFileAssociation(".bplist", filePath => {
            log.info("FILE ASSOCIATION RECEIVED", filePath);
            this.openOneClickDownloadPlaylistWindow(filePath);
        });
    }

    private async getPlaylistsFolder(version?: BSVersion) {
        const rootPath = version ? await this.versions.getVersionPath(version) : this.bsmFs.sharedContentPath();
        const fullPath = path.join(rootPath, this.PLAYLISTS_FOLDER);

        await ensureDir(fullPath);

        return fullPath;
    }

    private acceptPlaylistFiletype(filename: string): boolean {
        return this.PLAYLIST_FILETYPES.includes(path.extname(filename).toLowerCase());
    }

    public writeBPListFile(opt: { bpList: BPList, version?: BSVersion, dest?: string }): Observable<LocalBPList> {
        return new Observable<LocalBPList>(obs => {
            (async () => {
                const dest = await (async () => {
                    if(opt.dest && path.isAbsolute(opt.dest) && this.acceptPlaylistFiletype(opt.dest)) { return opt.dest; }
                    const playlistFolder = await this.getPlaylistsFolder(opt.version);
                    const playlistPath = path.join(playlistFolder, `${sanitize(opt.bpList.playlistTitle)}.bplist`);
                    return getUniqueFileNamePath(playlistPath);
                })();

                writeFileSync(dest, JSON.stringify(opt.bpList, null, 2));

                const localBPList: LocalBPList = { ...opt.bpList, path: dest };

                obs.next(localBPList);
            })()
            .catch(err => obs.error(err))
            .finally(() => obs.complete());
        });
    }

    private async installBPListFile(opt: {
        bplistSource: string,
        version?: BSVersion,
        dest?: string
    }): Promise<{path: string, localBPList: LocalBPList}> {
        const { bpList, filename } = await this.readPlaylistFromSource(opt.bplistSource);

        const dest = await (async () => {
            if(opt.dest && path.isAbsolute(opt.dest) && this.acceptPlaylistFiletype(opt.dest)) { return opt.dest; }
            const playlistFolder = await this.getPlaylistsFolder(opt.version);
            return path.join(playlistFolder, sanitize(filename));
        })();

        writeFileSync(dest, JSON.stringify(bpList, null, 2));

        const localBPList: LocalBPList = { ...bpList, path: dest };

        return { path: dest, localBPList };
    }


    private async readPlaylistFromSource(source: string): Promise<{ bpList: BPList, filename: string }> {
        const isLocalFile = await pathExists(source).catch(e => { log.error(e); return false; });

        if(!isLocalFile && !isValidUrl(source)) {
            throw new CustomError(`Invalid source (${source})`, "INVALID_SOURCE");
        }

        const { bpList, filename }: { bpList: BPList, filename: string } = await (async () => {
            if(isLocalFile){
                const res = await tryit(async () => JSON.parse(readFileSync(source).toString()) as BPList);
                if(res.error) {
                    throw CustomError.fromError(res.error, "CANNOT_PARSE_PLAYLIST");
                }
                return { bpList: res.result, filename: path.basename(source) };
            }

            const res = await this.request.getJSON<BPList>(source);
            const filename = this.request.getFilenameFromContentDisposition(res.headers["content-disposition"]) ?? `${res.data.playlistTitle}.bplist`;
            return { bpList: res.data, filename };
        })();

        if(!bpList?.playlistTitle) {
            throw new CustomError(`Invalid playlist file (${source})`, "INVALID_PLAYLIST_FILE");
        }

        bpList.songs = (bpList.songs ?? []).map(s => s.hash ? (
            { ...s, hash: findHashInString(s.hash) ?? s.hash }
        ) : s).filter(Boolean);

        return { bpList, filename };
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

                const ignoreFunc = (file: string, stats: Stats): boolean => {
                    if(stats.isFile() && !this.acceptPlaylistFiletype(file)) { return true; }
                    return false;
                }

                const playlistPaths = (await recursiveReadDir(folerPath, [ignoreFunc]));

                progress.total = playlistPaths.length;

                for (const playlistPath of playlistPaths) {
                    const {result, error} = await tryit(() => this.readPlaylistFromSource(playlistPath));

                    if(error) {
                        log.error(error);
                        continue;
                    }

                    const localBpList: LocalBPList = { ...result.bpList, path: playlistPath };
                    bpLists.push(localBpList);
                    progress.current += 1;
                    obs.next(progress);
                }

                progress.data = bpLists;
                obs.next(progress);
            })().catch(err => obs.error(err)).finally(() => obs.complete());
        });
    }

    private getSongDetailsFromPlaylistSong(song: PlaylistSong): SongDetails | undefined {
        let songDetails: SongDetails;

        const songHash = findHashInString(song.hash);
        if(songHash){
            songDetails = this.songDetails.getSongDetails(song.hash);
        }

        if(song.key && !songDetails){
            songDetails = this.songDetails.getSongDetailsById(song.key);
        }

        const levelIdHash = findHashInString(song.levelid);
        if(levelIdHash && !songDetails){
            songDetails = this.songDetails.getSongDetails(levelIdHash);
        }
        return songDetails;
    }

    public getLocalBPListDetails(localBPList: LocalBPList): LocalBPListsDetails {

        const tryExtractPlaylistId = (url: string) => {
            const regex = /\/id\/(\d+)\/download/;
            const match = regex.exec(url);
            return match ? Number(match[1]) : undefined;
        }

        const bpListDetails: LocalBPListsDetails = {
            ...localBPList,
            duration: 0,
            nbMaps: localBPList.songs?.length ?? 0,
            id: localBPList.customData?.syncURL ? tryExtractPlaylistId(localBPList.customData.syncURL) : undefined,
            minNps: Infinity,
            maxNps: -Infinity,
        }

        const mappers = new Set<number>();

        for(const song of localBPList.songs){
            const songDetails = this.getSongDetailsFromPlaylistSong(song);

            if(!songDetails) { continue; }

            bpListDetails.duration += songDetails?.duration ? +songDetails.duration : 0;
            mappers.add(songDetails.uploader?.id);

            const mapNps = songDetails.difficulties?.map(d => d?.nps).filter(nps => typeof nps === "number" && !Number.isNaN(nps));

            if(mapNps?.length){
                bpListDetails.minNps = Math.min(bpListDetails.minNps, ...mapNps);
                bpListDetails.maxNps = Math.max(bpListDetails.maxNps, ...mapNps);
            }

            song.songDetails = songDetails;
        }

        if(!Number.isFinite(bpListDetails.minNps)){
            bpListDetails.minNps = 0;
        }

        if(!Number.isFinite(bpListDetails.maxNps)){
            bpListDetails.maxNps = 0;
        }

        bpListDetails.nbMappers = mappers.size;

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

    public downloadPlaylistSongs(localBPList: LocalBPList, ignoreSongsHashs: string[], version: BSVersion): Observable<Progression<DownloadPlaylistProgressionData>> {

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

                    const mapDetail = await (async () => {
                        let mapDetail: BsvMapDetail;

                        const mapHash = findHashInString(song?.hash);
                        if(mapHash) {
                            mapDetail = (await this.bsaver.getMapDetailsFromHashs([findHashInString(mapHash)])).at(0);
                        }

                        if(song.key && !mapDetail) {
                            mapDetail = await this.bsaver.getMapDetailsById(song.key);
                        }

                        const levelIdHash = findHashInString(song?.levelid);
                        if(levelIdHash && !mapDetail) {
                            mapDetail = (await this.bsaver.getMapDetailsFromHashs([levelIdHash])).at(0);
                        }

                        return mapDetail;
                    })().catch(e => {
                        log.error(e);
                        return undefined as BsvMapDetail;
                    });

                    if(!mapDetail) {
                        continue;
                    }

                    const downloadedMap = await this.maps.downloadMap(mapDetail, version)
                        .catch(error => {
                            log.error(
                                "Could not download map for playlist",
                                `[${mapDetail.id}] "${mapDetail.name}"`,
                                error
                            );
                            return null;
                        });
                    if (!downloadedMap) {
                        continue;
                    }

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

    public downloadPlaylist({ bplistSource, version, ignoreSongsHashs = [], dest }: {
        bplistSource: string,
        version?: BSVersion
        ignoreSongsHashs?: string[]
        dest?: string
    }): Observable<Progression<DownloadPlaylistProgressionData>> {

        const destroyed$ = new Subject<void>()

        return new Observable<Progression<DownloadPlaylistProgressionData>>(obs => {
            (async () => {

                const { localBPList } = await this.installBPListFile({ bplistSource, version, dest });

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

    public deletePlaylistFile(bpList: LocalBPList): Observable<void>{
        return from(deleteFile(bpList.path));
    }

    public exportPlaylists(opt: {version?: BSVersion, bpLists: LocalBPList[], dest: string, playlistsMaps?: BsmLocalMap[]}): Observable<Progression<string>> {

        if(!pathExistsSync(opt.dest)) {
            throw new CustomError(`Destination folder not found ${opt.dest}`, "DEST_ENOENT");
        }

        if(opt.bpLists?.length === 0) {
            throw new CustomError("No playlists to export", "NO_PLAYLISTS");
        }

        const versionName = opt.version ? opt.version.name ?? opt.version.BSVersion : "Shared";
        const destName = opt.version ? `${versionName} Playlists` : "Playlists";
        const zipDest = path.join(opt.dest, `${destName}.zip`);

        const archive = new Archive(zipDest)

        for(const bpList of opt.bpLists) {

            if(!pathExistsSync(bpList.path)) {
                log.warn(`Playlist file not found for export`, bpList.path);
                continue;
            }

            archive.addFile(bpList.path, path.join(this.PLAYLISTS_FOLDER, path.basename(bpList.path)));
        }

        if(!Array.isArray(opt.playlistsMaps) || opt.playlistsMaps.length === 0){
            return archive.finalize();
        }

        for(const map of opt.playlistsMaps) {

            if(!map?.path || !pathExistsSync(map.path)) {
                log.warn(`Map file not found for playlist export`, map?.path);
                continue;
            }

            archive.addDirectory(
                map.path,
                path.join("Maps", path.basename(map.path)) // Dont't know why, but "CustomLevels" not work
            );
        }

        return archive.finalize();
    }

    public importPlaylists({ version, paths }: { version?: BSVersion, paths: string[] }): Observable<Progression<LocalBPListsDetails>> {
        return new Observable<Progression<LocalBPListsDetails>>(obs => {

            let canceled = false;

            (async () => {
                const bplistPaths = paths.filter(p => this.acceptPlaylistFiletype(p));
                const progress: Progression<LocalBPListsDetails> = { current: 0, total: bplistPaths.length, data: null };

                obs.next(progress);

                for(const playlistPath of bplistPaths) {
                    if(canceled) {
                        log.info("Playlist import canceled");
                        return;
                    }

                    const { result: localBPList, error } = await tryit(() => this.installBPListFile({ bplistSource: playlistPath, version }));

                    if(error) {
                        progress.lastError = serializeError(CustomError.fromError(error));
                        obs.next(progress);

                        log.error(error);
                        continue;
                    }

                    const bpListDetails = this.getLocalBPListDetails(localBPList.localBPList);

                    progress.current += 1;
                    progress.data = bpListDetails;
                    obs.next(progress);
                }
            })()
            .catch(err => obs.error(err))
            .finally(() => obs.complete());

            return () => {
                canceled = true;
            }
        });
    }

    public oneClickInstallPlaylist(bplistUrl: string): Observable<Progression<DownloadPlaylistProgressionData>> {

        return new Observable<Progression<DownloadPlaylistProgressionData>>(obs => {
            (async () => {
                const versions = await this.versions.getInstalledVersions();

                const download$ = this.downloadPlaylist({ bplistSource: bplistUrl, version: versions.pop() }).pipe(tap({
                    next: progress => obs.next(progress),
                    error: err => obs.error(err),
                }));

                const { data: {downloadedMaps, playlist} } = await lastValueFrom(download$);

                if(downloadedMaps?.length === 0 || !playlist.path) { return; }

                const realSourceMapsFolder = await realpath(path.dirname(downloadedMaps[0].path));

                for (const version of versions) {
                    await this.installBPListFile({ bplistSource: playlist.path, version});

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
