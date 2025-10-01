import path from "path";
import { BSVersion } from "shared/bs-version.interface";
import { BsvMapDetail } from "shared/models/maps";
import { BsmLocalMap, BsmLocalMapMetadata, BsmLocalMapsProgress, DeleteMapsProgress } from "shared/models/maps/bsm-local-map.interface";
import { BSLocalVersionService } from "../../bs-local-version.service";
import { InstallationLocationService } from "../../installation-location.service";
import { UtilsService } from "../../utils.service";
import crypto, { BinaryLike } from "crypto";
import { lstatSync } from "fs";
import { copy, createReadStream, ensureDir, existsSync, pathExists, pathExistsSync, readJson, realpath, writeJson } from "fs-extra";
import { RequestService } from "../../request.service";
import sanitize from "sanitize-filename";
import { DeepLinkService } from "../../deep-link.service";
import log from "electron-log";
import { WindowManagerService } from "../../window-manager.service";
import { Observable, Subject, lastValueFrom } from "rxjs";
import { Archive } from "../../../models/archive.class";
import { Progression, deleteFile, deleteFolder, ensureFolderExist, getFilesInFolder, getFoldersInFolder, pathExist } from "../../../helpers/fs.helpers";
import { readFile } from "fs/promises";
import { FolderLinkerService } from "../../folder-linker.service";
import { allSettled } from "../../../../shared/helpers/promise.helpers";
import { splitIntoChunk } from "../../../../shared/helpers/array.helpers";
import { SongDetailsCacheService } from "./song-details-cache.service";
import { SongCacheService } from "./song-cache.service";
import { pathToFileURL } from "url";
import { sToMs } from "../../../../shared/helpers/time.helpers";
import { FieldRequired } from "shared/helpers/type.helpers";
import { MapInfo } from "shared/models/maps/info/map-info.model";
import { parseMapInfoDat } from "shared/parsers/maps/map-info.parser";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { tryit } from "shared/helpers/error.helpers";
import { BsmZipExtractor } from "main/models/bsm-zip-extractor.class";
import { escapeRegExp } from "../../../../shared/helpers/string.helpers";
import dateFormat from "dateformat";

export class LocalMapsManagerService {
    private static instance: LocalMapsManagerService;

    public static getInstance(): LocalMapsManagerService {
        if (!LocalMapsManagerService.instance) {
            LocalMapsManagerService.instance = new LocalMapsManagerService();
        }
        return LocalMapsManagerService.instance;
    }

    public static readonly LEVELS_ROOT_FOLDER = "Beat Saber_Data";
    public static readonly CUSTOM_LEVELS_FOLDER = "CustomLevels";
    public static readonly RELATIVE_MAPS_FOLDER = path.join(LocalMapsManagerService.LEVELS_ROOT_FOLDER, LocalMapsManagerService.CUSTOM_LEVELS_FOLDER);
    public static readonly SHARED_MAPS_FOLDER = "SharedMaps";
    public static readonly METADATA_FILE = "metadata.json";

    private readonly DEEP_LINKS = {
        BeatSaver: "beatsaver",
        ScoreSaber: "web+bsmap",
    };

    private readonly localVersion: BSLocalVersionService;
    private readonly installLocation: InstallationLocationService;
    private readonly utils: UtilsService;
    private readonly reqService: RequestService;
    private readonly deepLink: DeepLinkService;
    private readonly windows: WindowManagerService;
    private readonly linker: FolderLinkerService;
    private readonly songDetailsCache: SongDetailsCacheService;
    private readonly songCache: SongCacheService;

    private readonly _lastDownloadedMap = new Subject<{ map: BsmLocalMap, version?: BSVersion }>();

    private constructor() {
        this.localVersion = BSLocalVersionService.getInstance();
        this.installLocation = InstallationLocationService.getInstance();
        this.utils = UtilsService.getInstance();
        this.reqService = RequestService.getInstance();
        this.deepLink = DeepLinkService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.linker = FolderLinkerService.getInstance();
        this.songDetailsCache = SongDetailsCacheService.getInstance();
        this.songCache = SongCacheService.getInstance();

        const handleOneClick = (mapId: string, isHash = false) => {
            this.windows.openWindow(`oneclick-download-map.html?mapId=${mapId}&isHash=${isHash}`);
        }

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.BeatSaver, link => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.BeatSaver, link);
            handleOneClick(new URL(link).host);
        });

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.ScoreSaber, link => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.ScoreSaber, link);
            handleOneClick(new URL(link).host, true);
        });
    }

    public async getMapsFolderPath(version?: BSVersion): Promise<string> {
        if (version) {
            return path.join(await this.localVersion.getVersionPath(version), LocalMapsManagerService.RELATIVE_MAPS_FOLDER);
        }
        const sharedMapsPath = path.join(this.installLocation.sharedContentPath(), LocalMapsManagerService.SHARED_MAPS_FOLDER, LocalMapsManagerService.CUSTOM_LEVELS_FOLDER);
        if (!(await pathExist(sharedMapsPath))) {
            await ensureFolderExist(sharedMapsPath);
        }
        return sharedMapsPath;
    }

    private async computeMapHash(mapPath: string, rawInfoString: string): Promise<string> {
        const { result: mapInfo, error } = tryit(() => parseMapInfoDat(JSON.parse(rawInfoString)));

        if(!mapInfo || error) {
            log.error(`Unable to cumpute hash, cannot parse map info at ${mapPath}`, error);
            throw CustomError.fromError(error, `Unable to cumpute hash, cannot parse map info at ${mapPath}`, "cannot-parse-map-info");
        }

        const shasum = crypto.createHash("sha1");
        shasum.update(rawInfoString);

        const hashFile = (filePath: string): Promise<void> => {
            return new Promise<void>((resolve, reject) => {
                const stream = createReadStream(filePath);
                stream.on("data", data => shasum.update(data as BinaryLike));
                stream.on("error", reject);
                stream.on("close", resolve);
            });
        };

        for (const diff of mapInfo.difficulties) {
            if(diff.beatmapFilename){
                const diffFilePath = path.join(mapPath, diff.beatmapFilename);
                await hashFile(diffFilePath);
            }

            if(diff.lightshowDataFilename) {
                const lightshowFilePath = path.join(mapPath, diff.lightshowDataFilename);
                await hashFile(lightshowFilePath);
            }
        }

        return shasum.digest("hex");
    }

    public async loadMapInfoFromPath(mapPath: string): Promise<BsmLocalMap> {

        const getUrlsAndReturn = (mapInfo: MapInfo, hash: string, mapPath: string, metadata: BsmLocalMapMetadata): BsmLocalMap => {
            const coverUrl = pathToFileURL(path.join(mapPath, mapInfo.coverImageFilename)).href;
            const songUrl = pathToFileURL(path.join(mapPath, mapInfo.songFilename)).href;
            return {
                mapInfo, coverUrl, songUrl, hash, path: mapPath,
                songDetails: this.songDetailsCache.getSongDetails(hash),
                metadata,
            };
        };

        const cachedMapInfos = this.songCache.getMapInfoFromDirname(path.basename(mapPath));

        if (cachedMapInfos) {
            const metadata = await this.getMetadata(mapPath);
            return getUrlsAndReturn(cachedMapInfos.mapInfo, cachedMapInfos.hash, mapPath, metadata);
        }

        const files = await getFilesInFolder(mapPath);
        const infoFile = files.find(file => path.basename(file).toLowerCase() === "info.dat");

        if (infoFile === null) {
            return null;
        }

        const rawInfoString = await readFile(infoFile, { encoding: "utf-8" });
        const { result: mapInfo, error } = tryit(() => parseMapInfoDat(JSON.parse(rawInfoString)));

        if (error) {
            log.error(`Cannot parse map info.dat. Map path: ${mapPath}`, error);
            throw CustomError.fromError(error, `Cannot read map info.dat. Map path: ${mapPath}`, "cannot-parse-map-info");
        }

        const hash = await this.computeMapHash(mapPath, rawInfoString);
        const metadata = await this.getMetadata(mapPath);

        return getUrlsAndReturn(mapInfo, hash, mapPath, metadata);
    }

    private async downloadMapZip(zipUrl: string): Promise<string> {
        const fileName = `${path.basename(zipUrl, ".zip")}-${crypto.randomUUID()}.zip`;
        const tempPath = this.utils.getTempPath();
        await ensureFolderExist(this.utils.getTempPath());
        const dest = path.join(tempPath, fileName);

        return (await lastValueFrom(this.reqService.downloadFile(zipUrl, dest))).data;
    }

    public getMaps(version?: BSVersion): Observable<BsmLocalMapsProgress> {
        const progression: BsmLocalMapsProgress = {
            total: 0,
            loaded: 0,
            maps: [],
        };

        return new Observable<BsmLocalMapsProgress>(observer => {
            (async () => {
                await this.songDetailsCache.waitLoaded(sToMs(30));

                const levelsFolder = await this.getMapsFolderPath(version);

                if(!(await pathExist(levelsFolder))) {
                    return observer.complete();
                }

                const levelsPaths =  (await getFoldersInFolder(levelsFolder)) ?? [];
                progression.total = levelsPaths.length;

                const pathChunks = splitIntoChunk(levelsPaths, 50);

                const loadedMaps: BsmLocalMap[] = [];

                for (const chunk of pathChunks) {
                    const mapsInfo = await allSettled(chunk.map(async mapPath => {
                        const mapInfo = await this.loadMapInfoFromPath(mapPath);

                        if(!mapInfo) {
                            return null;
                        }

                        this.songCache.setMapInfoFromDirname(path.basename(mapPath), { mapInfo: mapInfo.mapInfo, hash: mapInfo.hash });

                        progression.loaded++;
                        observer.next(progression);
                        return mapInfo;
                    }), {removeFalsy: true});

                    loadedMaps.push(...(mapsInfo ?? []));
                }

                progression.maps = loadedMaps;

                observer.next(progression);
            })().then(() => {
                observer.complete();
            }).catch(e=> {
                observer.error(e);
            });
        });
    }

    public async versionIsLinked(version: BSVersion): Promise<boolean> {
        const levelsPath = await this.getMapsFolderPath(version);

        const isPathExist = await pathExist(levelsPath);

        if (!isPathExist) {
            return false;
        }

        return lstatSync(levelsPath).isSymbolicLink();
    }

    public async linkVersionMaps(version: BSVersion, keepMaps: boolean): Promise<void> {
        const versionMapsPath = await this.getMapsFolderPath(version);
        return this.linker.linkFolder(versionMapsPath, { keepContents: keepMaps, intermediateFolder: LocalMapsManagerService.SHARED_MAPS_FOLDER });
    }

    public async unlinkVersionMaps(version: BSVersion, keepMaps: boolean): Promise<void> {
        const versionMapsPath = await this.getMapsFolderPath(version);
        return this.linker.unlinkFolder(versionMapsPath, { keepContents: keepMaps, intermediateFolder: LocalMapsManagerService.SHARED_MAPS_FOLDER });
    }

    public deleteMaps(maps: FieldRequired<BsmLocalMap, "path">[]): Observable<DeleteMapsProgress> {
        return new Observable<DeleteMapsProgress>(observer => {
            const progress: DeleteMapsProgress = { total: maps.length, deleted: 0 };

            (async () => {
                for (const map of maps) {
                    const mapPath = map.path;

                    if (pathExistsSync(mapPath)) {
                        await deleteFolder(mapPath);
                        this.songCache.deleteMapInfoFromDirname(path.basename(mapPath));
                        progress.deleted++;
                    }

                    observer.next(progress);
                }
            })()
            .catch(e => observer.error(e))
            .finally(() => observer.complete());
        });
    }

    public deleteMapsFromHashs(version: BSVersion, hashs: string[]): Observable<Progression> {
        return new Observable<Progression>(observer => {
            const progress: Progression = { total: hashs.length, current: 0 };

            observer.next(progress);

            (async () => {
                const versionMapsPath = await this.getMapsFolderPath(version);
                const mapsPaths = await getFoldersInFolder(versionMapsPath);

                for (const mapPath of mapsPaths) {
                    const { result: mapInfo } = await tryit(() => this.loadMapInfoFromPath(mapPath));
                    if (mapInfo && hashs.includes(mapInfo.hash)) {
                        await deleteFolder(mapPath);
                        this.songCache.deleteMapInfoFromDirname(path.basename(mapPath));
                        progress.current++;
                    }

                    observer.next(progress);
                }
            })()
            .catch(e => observer.error(e))
            .finally(() => observer.complete());
        });
    }

    public async getMapInfoFromHash(hash: string, version?: BSVersion): Promise<BsmLocalMap> {
        const versionMapsPath = await this.getMapsFolderPath(version);
        const mapInfo = this.songCache.getMapInfoFromHash(hash);

        const cachedMapPath = (versionMapsPath && mapInfo?.dirname) && path.join(versionMapsPath, mapInfo.dirname);

        if(cachedMapPath && pathExistsSync(cachedMapPath)){
            return this.loadMapInfoFromPath(cachedMapPath);
        }

        // if not in cache, search in the folder
        const mapsPaths = await getFoldersInFolder(versionMapsPath);

        for (const mapPath of mapsPaths) {
            const { result: mapInfo } = await tryit(() => this.loadMapInfoFromPath(mapPath));
            if (mapInfo?.hash === hash) {
                return mapInfo;
            }
        }

        return null;
    }

    public importMaps(zipPaths: string[], version?: BSVersion): Observable<Progression<BsmLocalMap>> {
        return new Observable<Progression<BsmLocalMap>>(obs => {
            let progress: Progression<BsmLocalMap> = { total: 0, current: 0 };
            let nbImportedMaps = 0;
            const abortController = new AbortController();
            let zip: BsmZipExtractor;

            (async () => {
                const mapsPath = await this.getMapsFolderPath(version);
                for(const zipPath of zipPaths) {
                    if(abortController.signal?.aborted) {
                        log.info("Maps import from zip has been cancelled");
                        return;
                    }

                    progress = { total: 0, current: 0 };
                    obs.next(progress); // reset progress for each zip

                    if(!pathExistsSync(zipPath)) { continue; }

                    zip = await BsmZipExtractor.fromPath(zipPath);
                    const mapsFolders = (await zip.filterEntries(entry => /(^|\/)[Ii]nfo\.dat$/.test(entry.fileName)))
                        .map(entry => path.dirname(entry.fileName));

                    if (mapsFolders.length === 0) {
                        log.warn("No maps \"info.dat\" found in zip", zipPath);
                        progress.total = 1;
                        progress.current = 1;
                        obs.next(progress);
                        continue;
                    }

                    progress.total = mapsFolders.length;
                    obs.next(progress);

                    const isRoot = mapsFolders.length === 1 && mapsFolders[0] === ".";
                    const destination = isRoot
                        ? path.join(mapsPath, path.basename(zipPath, ".zip"))
                        : mapsPath;

                    log.info("Extracting", `"${zipPath}"`, "into", `"${mapsPath}"`);
                    for (const folder of mapsFolders) {
                        log.info(">", folder);

                        const entriesNames = isRoot
                            ? null
                            : [ new RegExp(`^${escapeRegExp(folder)}\\/`) ];

                        const exported = await zip.extract(destination, {
                            entriesNames,
                            abortToken: abortController
                        });

                        if(exported.length === 0) {
                            log.warn("No files extracted from", folder);
                            continue;
                        }

                        if (abortController.signal?.aborted) {
                            break;
                        }

                        ++nbImportedMaps;
                        ++progress.current;
                        progress.data = await this.loadMapInfoFromPath(path.join(destination, folder));
                        obs.next(progress);

                        if (abortController.signal?.aborted) {
                            break;
                        }
                    }

                    zip.close();

                    if (abortController.signal?.aborted) {
                        log.info("Maps import from zip has been cancelled");
                        return;
                    }
                }
            })()
            .then(() => {
                if(!nbImportedMaps){
                    throw new CustomError("No \"Info.dat\" file located in any of the zip files", "invalid-zip");
                }
                return log.info("Successfully imported", nbImportedMaps, "maps from", zipPaths.length, "zips");
            })
            .catch(e => obs.error(e))
            .finally(() => {
                if (zip) {
                    zip.close();
                }
                obs.complete()
            });

            return () => {
                abortController.abort();
            };
        });
    }

    public async downloadMap(map: BsvMapDetail, version?: BSVersion): Promise<BsmLocalMap> {
        if (!map.versions.at(0).hash) {
            throw new Error("Cannot download map, no hash found");
        }

        const zipUrl = map.versions.at(0).downloadURL;

        log.info("Downloading map", map.name, map.id, zipUrl);

        const mapFolderName = sanitize(`${map.id} (${map.metadata.songName} - ${map.metadata.levelAuthorName})`);
        const mapsFolder = await this.getMapsFolderPath(version);

        const mapPath = path.join(mapsFolder, mapFolderName);

        const installedMap = await pathExists(mapPath).then(exists => {
            if(!exists){ return null; }
            return this.loadMapInfoFromPath(mapPath);
        }).catch(() => null);

        if(map.versions.every(version => version.hash === installedMap?.hash)) {
            return installedMap;
        }

        const zipPath = await this.downloadMapZip(zipUrl);
        const zip = await BsmZipExtractor.fromPath(zipPath);
        await zip.extract(mapPath);
        zip.close();
        await deleteFile(zipPath);

        const localMap = await this.loadMapInfoFromPath(mapPath);
        localMap.songDetails = this.songDetailsCache.getSongDetails(localMap.hash);

        this._lastDownloadedMap.next({ map: localMap, version });

        return localMap;
    }

    private async getMetadata(mapPath: string): Promise<BsmLocalMapMetadata> {
        const metadataPath = path.join(mapPath, LocalMapsManagerService.METADATA_FILE);
        if (existsSync(metadataPath)) {
            return await readJson(metadataPath) as BsmLocalMapMetadata;
        }

        // Create the metadata then return it to the user
        const metadata: BsmLocalMapMetadata = {
            addedDate: dateFormat(new Date(), "yyyy-mm-dd'T'hh:MM:ss.l"),
        };

        await writeJson(metadataPath, metadata);
        return metadata;
    }

    public async exportMaps(version: BSVersion, maps: BsmLocalMap[], outPath: string): Promise<Observable<Progression>> {
        const archive = new Archive(outPath);

        if (!maps || maps.length === 0) {
            const mapsFolder = await this.getMapsFolderPath(version);
            archive.addDirectory(mapsFolder, false);
        } else {
            const mapsFolders = maps.map(map => map.path);
            mapsFolders.forEach(maps => archive.addDirectory(maps));
        }

        return archive.finalize();
    }

    public async oneClickDownloadMap(map: BsvMapDetail): Promise<void> {

        const versions = await this.localVersion.getInstalledVersions();
        const downloadedMap = await this.downloadMap(map, versions.pop());
        const downloadedMapRealFolder = await realpath(path.dirname(downloadedMap.path));

        for (const version of versions) {
            const versionMapsPath = await this.getMapsFolderPath(version);
            await ensureDir(versionMapsPath);

            if((await realpath(versionMapsPath)) === downloadedMapRealFolder){
                continue;
            }

            await copy(downloadedMap.path, path.join(versionMapsPath, path.basename(downloadedMap.path)), { overwrite: true });
        }
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

    public get lastDownloadedMap$(): Observable<{ map: BsmLocalMap, version?: BSVersion }> {
        return this._lastDownloadedMap.asObservable();
    }
}
