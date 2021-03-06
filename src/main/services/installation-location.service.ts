import path from "path";
import { ConfigurationService } from "./configuration.service";
import { UtilsService } from "./utils.service";
import fs from 'fs-extra';
import log from "electron-log";
import { app } from "electron";
import { BsmException } from "shared/models/bsm-exception.model";

export class InstallationLocationService {

    private static instance: InstallationLocationService;

    private readonly INSTALLATION_FOLDER = "BSManager";
    private readonly VERSIONS_FOLDER = "BSInstances";
    private readonly STORE_INSTALLATION_PATH_KEY = "installation-folder";


    private readonly configService: ConfigurationService;
    private readonly utilsService: UtilsService;


    private _installationDirectory: string;

    public static getInstance(): InstallationLocationService{
        if(!InstallationLocationService.instance){ InstallationLocationService.instance = new InstallationLocationService(); }
        return InstallationLocationService.instance;   
    }

    private constructor(){
        this.configService = ConfigurationService.getInstance();
        this.utilsService = UtilsService.getInstance();
        this.initInstallationLocation();
    }

    private initInstallationLocation(): void{
        this._installationDirectory = this.configService.get<string>(this.STORE_INSTALLATION_PATH_KEY) || app.getPath("documents");
    }

    public get installationDirectory(): string{ return path.join(this._installationDirectory, this.INSTALLATION_FOLDER); }
    public get versionsDirectory(): string { return path.join(this.installationDirectory, this.VERSIONS_FOLDER); }

    public setInstallationDirectory(newDir: string): Promise<string>{
        const oldDir = this.installationDirectory;
        const newDest = path.join(newDir, this.INSTALLATION_FOLDER);
        return new Promise<string>((resolve, reject) => {
            if(!this.utilsService.folderExist(oldDir)){ this.utilsService.createFolderIfNotExist(oldDir); }
            fs.move(oldDir, newDest, { overwrite: true }).then(() => {
                this._installationDirectory = newDir;
                this.configService.store.set(this.STORE_INSTALLATION_PATH_KEY, newDir);
                resolve(this.installationDirectory);
            }).catch((err: Error) => {
                reject({title: "CantMoveFolder", error: err} as BsmException);
                log.error(err);
            })
        })
        
    }

}