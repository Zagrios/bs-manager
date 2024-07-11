import path from "path";
import { BSVersion } from "shared/bs-version.interface";
import { BsvMapDetail, RawMapInfoData } from "shared/models/maps";
import { BsmLocalMap, BsmLocalMapsProgress, DeleteMapsProgress } from "shared/models/maps/bsm-local-map.interface";
import { BSLocalVersionService } from "../../bs-local-version.service";
import { InstallationLocationService } from "../../installation-location.service";
import { UtilsService } from "../../utils.service";
import crypto from "crypto";
import { lstatSync } from "fs";
import { copy, createReadStream, ensureDir, pathExists, pathExistsSync, realpath, unlink } from "fs-extra";
import StreamZip from "node-stream-zip";
import { RequestService } from "../../request.service";
import sanitize from "sanitize-filename";
import { DeepLinkService } from "../../deep-link.service";
import log from "electron-log";
import { WindowManagerService } from "../../window-manager.service";
import { Observable, lastValueFrom } from "rxjs";
import { Archive } from "../../../models/archive.class";
import { Progression, deleteFolder, ensureFolderExist, getFilesInFolder, getFoldersInFolder, pathExist } from "../../../helpers/fs.helpers";
import { readFile } from "fs/promises";
import { FolderLinkerService } from "../../folder-linker.service";
import { allSettled } from "../../../../shared/helpers/promise.helpers";
import { splitIntoChunk } from "../../../../shared/helpers/array.helpers";
import { SongDetailsCacheService } from "./song-details-cache.service";
import { SongCacheService } from "./song-cache.service";
import { IpcService } from "../../ipc.service";
import { pathToFileURL } from "url";
import { sToMs } from "../../../../shared/helpers/time.helpers";
import { FieldRequired } from "shared/helpers/type.helpers";

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
    private readonly ipc: IpcService;

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
        this.ipc = IpcService.getInstance();

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
        const mapRawInfo: RawMapInfoData = JSON.parse(rawInfoString);
        const shasum = crypto.createHash("sha1");
        shasum.update(rawInfoString);

        const hashFile = (filePath: string): Promise<void> => {
            return new Promise<void>((resolve, reject) => {
                const stream = createReadStream(filePath);
                stream.on("data", data => shasum.update(data));
                stream.on("error", reject);
                stream.on("close", resolve);
            });
        };

        for (const set of mapRawInfo._difficultyBeatmapSets) {
            for (const diff of set._difficultyBeatmaps) {
                const diffFilePath = path.join(mapPath, diff._beatmapFilename);
                await hashFile(diffFilePath);
            }
        }

        return shasum.digest("hex");
    }

    public async loadMapInfoFromPath(mapPath: string): Promise<BsmLocalMap> {

        const getUrlsAndReturn = (rawInfo: RawMapInfoData, hash: string, mapPath: string) => {
            const coverUrl = pathToFileURL(path.join(mapPath, rawInfo._coverImageFilename)).href;
            const songUrl = pathToFileURL(path.join(mapPath, rawInfo._songFilename)).href;
            return { rawInfo, coverUrl, songUrl, hash, path: mapPath, songDetails: this.songDetailsCache.getSongDetails(hash) } as BsmLocalMap;
        };

        const cachedInfos = this.songCache.getMapInfoFromDirname(path.basename(mapPath));

        if (cachedInfos) {
            return getUrlsAndReturn(cachedInfos.rawInfo, cachedInfos.hash, mapPath);
        }

        const files = await getFilesInFolder(mapPath);
        const infoFile = files.find(file => path.basename(file).toLowerCase() === "info.dat");

        if (infoFile === null) {
            return null;
        }

        const rawInfoString = await readFile(infoFile, { encoding: "utf-8" });
        const rawInfo: RawMapInfoData = JSON.parse(rawInfoString);
        const hash = await this.computeMapHash(mapPath, rawInfoString);

        return getUrlsAndReturn(rawInfo, hash, mapPath);
    }

    private async downloadMapZip(zipUrl: string): Promise<{ zip: StreamZip.StreamZipAsync; zipPath: string }> {
        const fileName = `${path.basename(zipUrl, ".zip")}-${crypto.randomUUID()}.zip`;
        const tempPath = this.utils.getTempPath();
        await ensureFolderExist(this.utils.getTempPath());
        const dest = path.join(tempPath, fileName);


        const zipPath = (await lastValueFrom(this.reqService.downloadFile(zipUrl, dest))).data;
        const zip = new StreamZip.async({ file: zipPath });

        return { zip, zipPath };
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

                        this.songCache.setMapInfoFromDirname(path.basename(mapPath), { rawInfo: mapInfo.rawInfo, hash: mapInfo.hash });

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

            (async () => {
                const versionMapsPath = await this.getMapsFolderPath(version);
                const mapsPaths = await getFoldersInFolder(versionMapsPath);

                for (const mapPath of mapsPaths) {
                    const mapInfo = await this.loadMapInfoFromPath(mapPath);
                    if (hashs.includes(mapInfo.hash)) {
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
            const mapInfo = await this.loadMapInfoFromPath(mapPath);
            if (mapInfo.hash === hash) {
                return mapInfo;
            }
        }

        return null;
    }


    public async downloadMap(map: BsvMapDetail, version?: BSVersion): Promise<BsmLocalMap> {
        if (!map.versions.at(0).hash) {
            throw new Error("Cannot download map, no hash found");
        }

        log.info("Downloading map", map.name, map.id);

        const zipUrl = map.versions.at(0).downloadURL;
        const mapFolderName = sanitize(`${map.id}-${map.name}`);
        const mapsFolder = await this.getMapsFolderPath(version);

        const mapPath = path.join(mapsFolder, mapFolderName);

        const installedMap = await pathExists(mapPath).then(exists => {
            if(!exists){ return null; }
            return this.loadMapInfoFromPath(mapPath);
        }).catch(() => null);

        if(map.versions.every(version => version.hash === installedMap?.hash)) {
            return installedMap;
        }

        const { zip, zipPath } = await this.downloadMapZip(zipUrl);

        if (!zip) {
            throw new Error(`Cannot download ${zipUrl}`);
        }

        await ensureFolderExist(mapPath);

        await zip.extract(null, mapPath);
        await zip.close();
        await unlink(zipPath);

        const localMap = await this.loadMapInfoFromPath(mapPath);
        localMap.songDetails = this.songDetailsCache.getSongDetails(localMap.hash);

        this.ipc.send<{map: BsmLocalMap, version?: BSVersion}>("map-downloaded", this.windows.getWindows("index.html").at(0), { map: localMap, version });

        return localMap;
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
}
