import path from "path";
import { BSVersion } from "shared/bs-version.interface";
import { BSLocalVersionService } from "./bs-local-version.service";
import archiver from "archiver";
import { createWriteStream } from "fs";
import log from "electron-log";

export class MapService{

    private readonly MAP_PATH = path.join("Beat Saber_Data", "CustomLevels");

    private static instance: MapService;
    
    private readonly localVersionService: BSLocalVersionService;

    public static getInstance(): MapService{
        if(!MapService.instance){ MapService.instance = new MapService(); }
        return MapService.instance;
    }

    private constructor(){
        this.localVersionService = BSLocalVersionService.getInstance();
    }

    private getMapsPath(versionPath: string): string{
        return path.join(versionPath, this.MAP_PATH);
    }

    public async exportVersionMaps(version: BSVersion, outputZip: string): Promise<void>{
        const versionPath = await this.localVersionService.getVersionPath(version);
        const mapsPath = this.getMapsPath(versionPath);

        console.log(outputZip);

        const output = createWriteStream(outputZip);
        const archive = archiver("zip", {zlib: {level: 9}});

        const promise = new Promise<void>((resolve, reject) => {
            archive.pipe(output);
            archive.directory(mapsPath, false);
            archive.on("error", reject);
            output.on("close", resolve);
            archive.finalize()
        });

        return promise;
    }

}