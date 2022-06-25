import path from "path";
import { ConfigurationService } from "./configuration.service";
import { UtilsService } from "./utils.service";
import fs from 'fs-extra';
import log from "electron-log";

export class InstallationLocationService {

    private static instance: InstallationLocationService;

    private readonly INSTALLATION_FOLDER = "BSManager";
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
        this._installationDirectory = (this.configService.get(this.STORE_INSTALLATION_PATH_KEY) || this.utilsService.getUserDocumentsFolder()) as string;
    }

    public get installationDirectory(): string{
        return path.join(this._installationDirectory, this.INSTALLATION_FOLDER);
    }

    public setInstallationDirectory(newDir: string): Promise<string>{
        const oldDir = this.installationDirectory;
        const newDest = path.join(newDir, this.INSTALLATION_FOLDER);
        return new Promise<string>((resolve, reject) => {
            fs.move(oldDir, newDest, { overwrite: true }).then(() => {
                this._installationDirectory = newDir;
                this.configService.store.set(this.STORE_INSTALLATION_PATH_KEY, newDir);
                resolve(this.installationDirectory);
            }).catch(err => {
                reject(err);
                log.error(err);
            })
        })
        
    }

}