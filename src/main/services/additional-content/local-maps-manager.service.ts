import path from "path";
import { BSVersion } from "shared/bs-version.interface";
import { BsvMapDetail, RawMapInfoData } from "shared/models/maps";
import { BsmLocalMap, BsmLocalMapsProgress, DeleteMapsProgress } from "shared/models/maps/bsm-local-map.interface";
import { BSLocalVersionService } from "../bs-local-version.service";
import { InstallationLocationService } from "../installation-location.service";
import { UtilsService } from "../utils.service";
import crypto from "crypto";
import { lstatSync, symlinkSync, unlinkSync, readdirSync, createWriteStream } from "fs";
import { copy, copySync } from "fs-extra";
import StreamZip from "node-stream-zip";
import { RequestService } from "../request.service";
import sanitize from "sanitize-filename";
import archiver from "archiver";
import { DeepLinkService } from "../deep-link.service";
import log from 'electron-log';
import { WindowManagerService } from "../window-manager.service";
import { ipcMain } from "electron";
import { IpcRequest } from 'shared/models/ipc';
import { Observable } from "rxjs";
import { defer } from "rxjs";
import { Archive } from "../../models/archive.class";

export class LocalMapsManagerService {

    private static instance: LocalMapsManagerService;

    public static getInstance(): LocalMapsManagerService{
        if(!LocalMapsManagerService.instance){ LocalMapsManagerService.instance = new LocalMapsManagerService(); }
        return LocalMapsManagerService.instance;
    }

    private readonly LEVELS_ROOT_FOLDER = "Beat Saber_Data";
    private readonly CUSTOM_LEVELS_FOLDER = "CustomLevels";

    private readonly DEEP_LINKS = {
        BeatSaver: "beatsaver",
        ScoreSaber: "web+bsmap"
    };

    private readonly localVersion: BSLocalVersionService;
    private readonly installLocation: InstallationLocationService;
    private readonly utils: UtilsService;
    private readonly reqService: RequestService;
    private readonly deepLink: DeepLinkService;
    private readonly windows: WindowManagerService;

    private constructor(){
        this.localVersion = BSLocalVersionService.getInstance();
        this.installLocation = InstallationLocationService.getInstance();
        this.utils = UtilsService.getInstance();
        this.reqService = RequestService.getInstance();
        this.deepLink = DeepLinkService.getInstance();
        this.windows = WindowManagerService.getInstance();

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.BeatSaver, (link) => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.BeatSaver, link);
            this.openOneClickDownloadMapWindow(new URL(link).host);
        });

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.ScoreSaber, (link) => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.ScoreSaber, link);
            this.openOneClickDownloadMapWindow(new URL(link).host, true);
        });
    }

    public async getMapsFolderPath(version?: BSVersion): Promise<string>{

        if(version){ return path.join(await this.localVersion.getVersionPath(version), this.LEVELS_ROOT_FOLDER, this.CUSTOM_LEVELS_FOLDER); }
        const sharedMapsPath = path.join(this.installLocation.sharedMapsPath, this.CUSTOM_LEVELS_FOLDER);
        if(!(await this.utils.pathExist(sharedMapsPath))){
            this.utils.createFolderIfNotExist(sharedMapsPath);
        }
        return sharedMapsPath;
    }

    private async computeMapHash(mapPath: string, rawInfoString: string): Promise<string>{
        const mapRawInfo = JSON.parse(rawInfoString);
        let content = rawInfoString;
        for(const set of mapRawInfo._difficultyBeatmapSets){
            for(const diff of set._difficultyBeatmaps){
                const diffFilePath = path.join(mapPath, diff._beatmapFilename);
                if(!await this.utils.pathExist(diffFilePath)){ continue; }
                const diffContent = (await this.utils.readFileAsync(diffFilePath)).toString();
                content += diffContent;
            }
        }

        const shasum = crypto.createHash("sha1");
        shasum.update(content);
        return shasum.digest("hex");
    }

    private async loadMapInfoFromPath(mapPath: string): Promise<BsmLocalMap>{
        const infoFilePath = path.join(mapPath, "Info.dat");

        if(!(await this.utils.pathExist(infoFilePath))){ return null; }

        const rawInfoString = await (await (this.utils.readFileAsync(infoFilePath))).toString();

        const rawInfo: RawMapInfoData = JSON.parse(rawInfoString);
        const coverUrl = new URL(`file:///${path.join(mapPath, rawInfo._coverImageFilename)}`).href;
        const songUrl = new URL(`file:///${path.join(mapPath, rawInfo._songFilename)}`).href;
        
        const hash = await this.computeMapHash(mapPath, rawInfoString);
        
        return {rawInfo, coverUrl, songUrl, hash, path: mapPath};
    }

    private async downloadMapZip(zipUrl: string): Promise<{zip: StreamZip.StreamZipAsync, zipPath: string}>{
        const fileName = path.basename(zipUrl);
        const tempPath = this.utils.getTempPath();
        this.utils.createFolderIfNotExist(this.utils.getTempPath());
        const dest = path.join(tempPath, fileName);

        const zipPath = await this.reqService.downloadFile(zipUrl, dest);
        const zip = new StreamZip.async({file : zipPath});

        return {zip, zipPath};
    }

    private openOneClickDownloadMapWindow(mapId: string, isHash = false): void{

        ipcMain.once("one-click-map-info", async (event, req: IpcRequest<void>) => {
            this.utils.ipcSend(req.responceChannel, {success: true, data: {id: mapId, isHash}});
        });
        
        this.windows.openWindow("oneclick-download-map.html");

    }

    public getMaps(version?: BSVersion): Observable<BsmLocalMapsProgress>{

        const progression: BsmLocalMapsProgress = {
            total: 0,
            loaded: 0,
            maps: []
        };

        return new Observable<BsmLocalMapsProgress>(observer => {
            (async () => {
                const levelsFolder = await this.getMapsFolderPath(version);

                const levelsPaths = (await this.utils.pathExist(levelsFolder)) ? this.utils.listDirsInDir(levelsFolder, true) : [];

                progression.total = levelsPaths.length;

                for(const levelPath of levelsPaths){
                    const mapInfo = await this.loadMapInfoFromPath(levelPath);
                    if(mapInfo){
                        progression.maps.push(mapInfo);
                        progression.loaded = progression.maps.length;
                        observer.next({...progression, maps: []});
                    }
                }

                observer.next(progression);

                observer.complete();
            })();
        });
    }

    public async versionIsLinked(version: BSVersion): Promise<boolean>{

        const levelsPath = await this.getMapsFolderPath(version);

        const isPathExist = await this.utils.pathExist(levelsPath);

        if(!isPathExist){ return false; }

        return lstatSync(levelsPath).isSymbolicLink()
    }

    public async linkVersionMaps(version: BSVersion, keepMaps: boolean): Promise<void>{

        if(await this.versionIsLinked(version)){ return; }

        const sharedMapsPath = await this.getMapsFolderPath();
        const versionMapsPath = await this.getMapsFolderPath(version);

        if(keepMaps){
            await this.utils.moveDirContent(versionMapsPath, sharedMapsPath);
        }

        await this.utils.deleteFolder(versionMapsPath);
        
        symlinkSync(sharedMapsPath, versionMapsPath, "junction");
    }

    public async unlinkVersionMaps(version: BSVersion, keepMaps: boolean): Promise<void>{
        
        const sharedMapsPath = await this.getMapsFolderPath();
        const versionMapsPath = await this.getMapsFolderPath(version);

        if(await this.versionIsLinked(version)){
            unlinkSync(versionMapsPath);
        }

        this.utils.createFolderIfNotExist(versionMapsPath);
        
        if(keepMaps){
            await copy(sharedMapsPath, versionMapsPath);
        }

    }

    public deleteMaps(maps: BsmLocalMap[]): Observable<DeleteMapsProgress>{
       
        const mapsFolders = maps.map(map => map.path);
        const mapsHashsToDelete = maps.map(map => map.hash);

        return new Observable<DeleteMapsProgress>(observer => {
            (async () => {
                const progress: DeleteMapsProgress = { total: maps.length, deleted: 0 };
                try{
                    for(const folder of mapsFolders){
                        const detail = await this.loadMapInfoFromPath(folder);
                        if(!mapsHashsToDelete.includes(detail?.hash)){ continue; }
                        await this.utils.deleteFolder(folder);
                        progress.deleted++;
                        observer.next(progress);
                    }
                }catch(e){
                    console.log(e);
                    observer.error(e);
                }
                observer.complete();
            })();
        });
    }

    public async downloadMap(map: BsvMapDetail, version?: BSVersion): Promise<BsmLocalMap>{

        if(!map.versions.at(0).hash){ throw "Cannot download map, no hash found"; }

        const zipUrl = map.versions.at(0).downloadURL;

        const mapsFolder = await this.getMapsFolderPath(version);

        const {zip, zipPath} = await this.downloadMapZip(zipUrl);

        const mapFolderName = sanitize(`${map.id}-${map.name}`);

        const mapPath = path.join(mapsFolder, mapFolderName);

        if(!zip){ throw `Cannot download ${zipUrl}`; }

        this.utils.createFolderIfNotExist(mapPath);

        await zip.extract(null, mapPath);
        await zip.close();

        unlinkSync(zipPath);

        const localMap = await this.loadMapInfoFromPath(mapPath);
        localMap.bsaverInfo = map;

        return localMap;
    }

    public async exportMaps(version: BSVersion, maps: BsmLocalMap[], outPath: string){

        const archive = new Archive(outPath);
        
        if(!maps || maps.length === 0){
            const mapsFolder = await this.getMapsFolderPath(version);
            archive.addDirectory(mapsFolder, false);
        }
        else{
            const mapsFolders = maps.map(map => map.path);
            mapsFolders.forEach(maps => archive.addDirectory(maps));
        }

        return archive.finalize()

    }

    public async oneClickDownloadMap(map: BsvMapDetail): Promise<void>{

        const downloadedMap = await this.downloadMap(map);

        const versions = await this.localVersion.getInstalledVersions();

        for(const version of versions){

            if(await this.versionIsLinked(version)){ continue; }

            const versionMapsPath = await this.getMapsFolderPath(version);

            this.utils.createFolderIfNotExist(versionMapsPath);

            copySync(downloadedMap.path, path.join(versionMapsPath, path.basename(downloadedMap.path)), {overwrite: true});

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