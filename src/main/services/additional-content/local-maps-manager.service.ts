import path from "path";
import { BSVersion } from "shared/bs-version.interface";
import { BsvMapDetail } from "shared/models/maps";
import { BsmLocalMap, BsmLocalMapsProgress, DeleteMapsProgress } from "shared/models/maps/bsm-local-map.interface";
import { BSLocalVersionService } from "../bs-local-version.service";
import { InstallationLocationService } from "../installation-location.service";
import { UtilsService } from "../utils.service";
import crypto from "crypto";
import { lstatSync } from "fs";
import { copy, createReadStream, ensureDir, pathExists, realpath, unlink } from "fs-extra";
import StreamZip from "node-stream-zip";
import { RequestService } from "../request.service";
import sanitize from "sanitize-filename";
import { DeepLinkService } from "../deep-link.service";
import log from "electron-log";
import { WindowManagerService } from "../window-manager.service";
import { Observable, lastValueFrom, of } from "rxjs";
import { Archive } from "../../models/archive.class";
import { deleteFolder, ensureFolderExist, getFilesInFolder, getFoldersInFolder, pathExist } from "../../helpers/fs.helpers";
import { readFile } from "fs/promises";
import { FolderLinkerService } from "../folder-linker.service";
import { allSettled } from "../../../shared/helpers/promise.helpers";
import { splitIntoChunk } from "../../../shared/helpers/array.helpers";
import { IpcService } from "../ipc.service";
import { parseMapInfoDat } from "../../../shared/parsers/maps/map-info.parser";

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
    private readonly ipc: IpcService;
    private readonly linker = FolderLinkerService.getInstance();

    private constructor() {
        this.localVersion = BSLocalVersionService.getInstance();
        this.installLocation = InstallationLocationService.getInstance();
        this.utils = UtilsService.getInstance();
        this.reqService = RequestService.getInstance();
        this.deepLink = DeepLinkService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.linker = FolderLinkerService.getInstance();
        this.ipc = IpcService.getInstance();

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.BeatSaver, link => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.BeatSaver, link);
            this.openOneClickDownloadMapWindow(new URL(link).host);
        });

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.ScoreSaber, link => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.ScoreSaber, link);
            this.openOneClickDownloadMapWindow(new URL(link).host, true);
        });
    }

    public async getMapsFolderPath(version?: BSVersion): Promise<string> {
        if (version) {
            return path.join(await this.localVersion.getVersionPath(version), LocalMapsManagerService.LEVELS_ROOT_FOLDER, LocalMapsManagerService.CUSTOM_LEVELS_FOLDER);
        }
        const sharedMapsPath = path.join(await this.installLocation.sharedContentPath(), LocalMapsManagerService.SHARED_MAPS_FOLDER, LocalMapsManagerService.CUSTOM_LEVELS_FOLDER);
        if (!(await pathExist(sharedMapsPath))) {
            await ensureFolderExist(sharedMapsPath);
        }
        return sharedMapsPath;
    }

    private async computeMapHash(mapPath: string, rawInfoString: string): Promise<string> {
        const mapInfo = parseMapInfoDat(JSON.parse(rawInfoString));
        const shasum = crypto.createHash("sha1");
        shasum.update(rawInfoString);

        const hashFile = (filePath: string): Promise<void> => {
            return new Promise<void>((resolve, reject) => {
                const stream = createReadStream(filePath);
                stream.on("data", (data: Buffer) => shasum.update(data as unknown as Uint8Array));
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

        const hash = shasum.digest("hex");

        console.log(mapPath, hash);

        return hash;
    }

    private async loadMapInfoFromPath(mapPath: string): Promise<BsmLocalMap> {
        const files = await getFilesInFolder(mapPath);
        const infoFile = files.find(file => path.basename(file).toLowerCase() === "info.dat");

        if (infoFile === null) {
            return null;
        }

        const rawInfoString = await readFile(infoFile, { encoding: "utf-8" });
        const mapInfo = parseMapInfoDat(JSON.parse(rawInfoString));

        const coverUrl = new URL(`file:///${path.join(mapPath, mapInfo.coverImageFilename)}`).href;
        const songUrl = new URL(`file:///${path.join(mapPath, mapInfo.songFilename)}`).href;

        const hash = await this.computeMapHash(mapPath, rawInfoString);

        return { mapInfo, coverUrl, songUrl, hash, path: mapPath };
    }

    private async downloadMapZip(zipUrl: string): Promise<{ zip: StreamZip.StreamZipAsync; zipPath: string }> {
        const fileName = `${path.basename(zipUrl, ".zip")}-${crypto.randomUUID()}.zip`;
        const tempPath = this.utils.getTempPath();
        await ensureFolderExist(this.utils.getTempPath());

        const zipPath = (await lastValueFrom(this.reqService.downloadFile(zipUrl, {
            destFolder: tempPath,
            filename: fileName
        }))).data;
        const zip = new StreamZip.async({ file: zipPath });

        return { zip, zipPath };
    }

    private openOneClickDownloadMapWindow(mapId: string, isHash = false): void {
        this.windows.openWindow("oneclick-download-map.html").then(window => {

            this.ipc.once("one-click-map-info", async (_, reply) => {
                reply(of({ id: mapId, isHash }));
            }, window.webContents.ipc);

        });


    }

    public getMaps(version?: BSVersion): Observable<BsmLocalMapsProgress> {
        const progression: BsmLocalMapsProgress = {
            total: 0,
            loaded: 0,
            maps: [],
        };

        return new Observable<BsmLocalMapsProgress>(observer => {
            (async () => {
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

    public deleteMaps(maps: BsmLocalMap[]): Observable<DeleteMapsProgress> {
        const mapsFolders = maps.map(map => map.path);
        const mapsHashsToDelete = maps.map(map => map.hash);

        return new Observable<DeleteMapsProgress>(observer => {
            (async () => {
                const progress: DeleteMapsProgress = { total: maps.length, deleted: 0 };
                try {
                    for (const folder of mapsFolders) {
                        const detail = await this.loadMapInfoFromPath(folder);
                        if (!mapsHashsToDelete.includes(detail?.hash)) {
                            continue;
                        }
                        await deleteFolder(folder);
                        progress.deleted++;
                        observer.next(progress);
                    }
                } catch (e) {
                    observer.error(e);
                }
                observer.complete();
            })();
        });
    }

    public async downloadMap(map: BsvMapDetail, version?: BSVersion): Promise<BsmLocalMap> {
        if (!map.versions.at(0).hash) {
            throw "Cannot download map, no hash found";
        }

        const zipUrl = map.versions.at(0).downloadURL;
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

        const { zip, zipPath } = await this.downloadMapZip(zipUrl);

        if (!zip) {
            throw `Cannot download ${zipUrl}`;
        }

        await ensureFolderExist(mapPath);

        await zip.extract(null, mapPath);
        await zip.close();
        await unlink(zipPath);

        const localMap = await this.loadMapInfoFromPath(mapPath);
        localMap.bsaverInfo = map;

        return localMap;
    }

    public async exportMaps(version: BSVersion, maps: BsmLocalMap[], outPath: string) {
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
