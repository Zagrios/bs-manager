import path from "path";
import { BSVersion } from "shared/bs-version.interface";
import { RawMapInfoData } from "shared/models/maps";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { BSLocalVersionService } from "../bs-local-version.service";
import { InstallationLocationService } from "../installation-location.service";
import { UtilsService } from "../utils.service";
import crypto from "crypto";
import { lstatSync, symlinkSync, unlinkSync, readdirSync } from "fs";
import { copySync } from "fs-extra";
import StreamZip from "node-stream-zip";
import { RequestService } from "../request.service";

export class LocalMapsManagerService {

    private static instance: LocalMapsManagerService;

    public static getInstance(): LocalMapsManagerService{
        if(!LocalMapsManagerService.instance){ LocalMapsManagerService.instance = new LocalMapsManagerService(); }
        return LocalMapsManagerService.instance;
    }

    private readonly LEVELS_ROOT_FOLDER = "Beat Saber_Data";
    private readonly CUSTOM_LEVELS_FOLDER = "CustomLevels";

    private readonly localVersion: BSLocalVersionService;
    private readonly installLocation: InstallationLocationService;
    private readonly utils: UtilsService;
    private readonly reqService: RequestService

    private constructor(){
        this.localVersion = BSLocalVersionService.getInstance();
        this.installLocation = InstallationLocationService.getInstance();
        this.utils = UtilsService.getInstance();
        this.reqService = RequestService.getInstance();
    }

    private async getMapsFolderPath(version?: BSVersion): Promise<string>{
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
        
        return {rawInfo, coverUrl, songUrl, hash};
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

    public async getMaps(version?: BSVersion): Promise<BsmLocalMap[]>{
        const levelsFolder = await this.getMapsFolderPath(version);

        const levelsPath = (await this.utils.pathExist(levelsFolder)) ? this.utils.listDirsInDir(levelsFolder, true) : [];

        const mapsInfo = await Promise.all(levelsPath.map(levelPath => this.loadMapInfoFromPath(levelPath)));

        return mapsInfo.filter(info => !!info);
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
            copySync(sharedMapsPath, versionMapsPath);
        }

    }

    public async deleteMaps(maps: BsmLocalMap[], verion?: BSVersion){
       
        const mapsFolder = await this.getMapsFolderPath(verion);

        const mapsHashsToDelete = maps.map(m => m.hash);

        const mapsFolders = readdirSync(mapsFolder, {withFileTypes: true});

        for(const content of mapsFolders){
            if(!content.isDirectory()){ continue; }
            const mapFolderPath = path.join(mapsFolder, content.name);
            const { hash } = await this.loadMapInfoFromPath(mapFolderPath);
            if(mapsHashsToDelete.includes(hash)){
                await this.utils.deleteFolder(mapFolderPath);
            }
        }

    }

    public async downloadMap(zipUrl: string, version?: BSVersion){

        console.log(zipUrl, version);

        const mapsFolder = await this.getMapsFolderPath(version);

        const {zip, zipPath} = await this.downloadMapZip(zipUrl);
        const zipName = path.parse(zipPath).name;

        const mapPath = path.join(mapsFolder, zipName);

        if(!zip){ throw `Cannot download ${zipUrl}`; }

        this.utils.createFolderIfNotExist(mapPath);

        await zip.extract(null, mapPath);
        await zip.close();

        unlinkSync(zipPath);
    }

    

}