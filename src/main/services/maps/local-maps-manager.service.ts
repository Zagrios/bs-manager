import path from "path";
import { BSVersion } from "shared/bs-version.interface";
import { RawMapInfoData } from "shared/models/maps";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { BSLocalVersionService } from "../bs-local-version.service";
import { InstallationLocationService } from "../installation-location.service";
import { UtilsService } from "../utils.service";
import crypto from "crypto";

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

    private constructor(){
        this.localVersion = BSLocalVersionService.getInstance();
        this.installLocation = InstallationLocationService.getInstance();
        this.utils = UtilsService.getInstance();
    }

    private async getMapsPath(version?: BSVersion): Promise<string>{
        if(version){ return path.join(await this.localVersion.getVersionPath(version), this.LEVELS_ROOT_FOLDER); }
        return this.installLocation.sharedMapsPath;
    }

    private async computeMapHash(mapPath: string, rawInfoString: string): Promise<string>{
        const mapRawInfo = JSON.parse(rawInfoString);
        let content = rawInfoString;
        console.log("oui");
        for(const set of mapRawInfo._difficultyBeatmapSets){
            for(const diff of set._difficultyBeatmaps){
                const diffFilePath = path.join(mapPath, diff._beatmapFilename);
                if(!await this.utils.pathExist(diffFilePath)){ continue; }
                const diffContent = (await this.utils.readFileAsync(diffFilePath)).toString()
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

    public async getMaps(version?: BSVersion): Promise<BsmLocalMap[]>{
        const levelsRoot = await this.getMapsPath(version);
        const levelsFolder = path.join(levelsRoot, this.CUSTOM_LEVELS_FOLDER);

        const levelsPath = (await this.utils.pathExist(levelsFolder)) ? this.utils.listDirsInDir(levelsFolder, true) : [];



        const mapsInfo = await Promise.all(levelsPath.map(levelPath => this.loadMapInfoFromPath(levelPath)))

        console.log(mapsInfo);

        return mapsInfo.filter(info => !!info);
    }

    public deleteMap(version?: BSVersion){

    }

}