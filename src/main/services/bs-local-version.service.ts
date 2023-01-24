import { BSVersionLibService } from "./bs-version-lib.service";
import { BSVersion, PartialBSVersion } from 'shared/bs-version.interface';
import { InstallationLocationService } from "./installation-location.service";
import { SteamService } from "./steam.service";
import { UtilsService } from "./utils.service";
import { BS_APP_ID, OCULUS_BS_DIR } from "../constants";
import path from "path";
import { createReadStream } from "fs";
import fs from "fs-extra";
import { ConfigurationService } from "./configuration.service";
import { rename } from "fs/promises";
import { BsmException } from "shared/models/bsm-exception.model";
import log from "electron-log";
import { OculusService } from "./oculus.service";
import { DownloadLinkType } from "shared/models/mods";
import sanitize from "sanitize-filename";

export class BSLocalVersionService{

   private static instance: BSLocalVersionService;

   private readonly CUSTOM_VERSIONS_KEY = "custom-versions";

   private readonly installLocationService: InstallationLocationService;
   private readonly utilsService: UtilsService;
   private readonly steamService: SteamService;
   private readonly oculusService: OculusService;
   private readonly remoteVersionService: BSVersionLibService;
   private readonly configService: ConfigurationService;

   public static getInstance(): BSLocalVersionService{
      if(!BSLocalVersionService.instance){ BSLocalVersionService.instance = new BSLocalVersionService(); }
      return BSLocalVersionService.instance;
   }

    private constructor(){
        this.installLocationService = InstallationLocationService.getInstance();
        this.utilsService = UtilsService.getInstance();
        this.steamService = SteamService.getInstance();
        this.oculusService = OculusService.getInstance();
        this.remoteVersionService = BSVersionLibService.getInstance();
        this.configService = ConfigurationService.getInstance();
    }

    

   public async getVersionOfBSFolder(bsPath: string): Promise<PartialBSVersion>{
      const versionFilePath = path.join(bsPath, 'Beat Saber_Data', 'globalgamemanagers');
      if(!this.utilsService.pathExist(versionFilePath)){ return null; }
      const versionsAvailable = await this.remoteVersionService.getAvailableVersions();
      return new Promise<PartialBSVersion>(resolve => {
         const stream = createReadStream(versionFilePath);
         let findVersion: PartialBSVersion = null;
         stream.on('data', (line) => {
            line = line.toString();
            for(const version of versionsAvailable){
               if(line.includes(version.BSVersion)){
                    findVersion = {BSVersion: version.BSVersion};
                    if(findVersion.BSVersion !== path.basename(bsPath)){
                        findVersion.name = path.basename(bsPath);
                    }
                    stream.close();
                    stream.destroy();
                    break;
                }
            }
         });
         stream.on('end', () => {
            if(findVersion){ resolve(findVersion) }
            resolve(findVersion);
         });
         stream.on('close', () => {
            if(findVersion){ resolve(findVersion) }
            resolve(findVersion);
         })
      })
   }

   private setCustomVersions(versions: BSVersion[]): void{
      this.configService.set(this.CUSTOM_VERSIONS_KEY, versions);
   }

   private addCustomVersion(version: BSVersion): void{
      this.setCustomVersions([...this.getCustomVersions() ?? [], version]);
   }

   private getCustomVersions(): BSVersion[]{
      return this.configService.get<BSVersion[]>(this.CUSTOM_VERSIONS_KEY) || [];
   }

   private deleteCustomVersion(version: BSVersion): void{
      const customVersions = this.getCustomVersions() || [];
      this.setCustomVersions(customVersions.filter(v => (v.name !== version.name || v.BSVersion !== version.BSVersion || v.color !== version.color)));
   }

   public async getVersionPath(version: BSVersion): Promise<string>{
      if(version.steam){ return this.steamService.getGameFolder(BS_APP_ID, "Beat Saber") }
      if(version.oculus){ return this.oculusService.getGameFolder(OCULUS_BS_DIR); }
      return path.join(
         this.installLocationService.versionsDirectory,
         this.getVersionFolder(version)
      );
   }

   private removeSpecialChar(seq: string): string{
      return sanitize(seq);
   }

    public getVersionFolder(version: BSVersion): string{
        return version.name ?? version.BSVersion;
    }

    public getVersionType(version: BSVersion): DownloadLinkType{
        if(version.steam){ return "steam"; }
        if(version.oculus){ return "oculus"; }
        return "universal"
    }

    private async getSteamVersion(): Promise<BSVersion>{
        const steamBsFolder = await this.steamService.getGameFolder(BS_APP_ID, "Beat Saber");

        if(!steamBsFolder || !this.utilsService.pathExist(steamBsFolder)){ return null; }
        const steamBsVersion = await this.getVersionOfBSFolder(steamBsFolder);

        if(!steamBsVersion){ return null; }
        const version = await this.remoteVersionService.getVersionDetails(steamBsVersion.BSVersion);
        if(!version){ return null; }
        return {...version, steam: true};
    }

    private async getOculusVersion(): Promise<BSVersion>{
        const oculusBsFolder = await this.oculusService.getGameFolder(OCULUS_BS_DIR);
        if(!oculusBsFolder){ return null; }
        const oculusBsVersion = await this.getVersionOfBSFolder(oculusBsFolder);
        if(!oculusBsVersion){ return null; }
        const version = await this.remoteVersionService.getVersionDetails(oculusBsVersion.BSVersion);
        if(!version){ return null; }
        return {...version, oculus: true};
    }

    public async getInstalledVersions(): Promise<BSVersion[]>{

        const versions: BSVersion[] = [];

        const steamVersion = await this.getSteamVersion();
        if(steamVersion){ versions.push(steamVersion); }

        const oculusVersion = await this.getOculusVersion();
        if(oculusVersion){ versions.push(oculusVersion); }  

        if(!this.utilsService.pathExist(this.installLocationService.versionsDirectory)){ return versions }

        const folderInInstallation = this.utilsService.listDirsInDir(this.installLocationService.versionsDirectory, true);

        for(const f of folderInInstallation){
            log.info("try get version from folder", f);
            const rawVersion = await this.getVersionOfBSFolder(f);
            if(!rawVersion){ continue; }
            const bsVersion = {...await this.remoteVersionService.getVersionDetails(rawVersion.BSVersion)};
            if(!bsVersion){ continue; }
            bsVersion.name = path.basename(f) !== bsVersion.BSVersion ? path.basename(f) : undefined;
            
            const customVersion = this.getCustomVersions().find(custom => custom.BSVersion === bsVersion.BSVersion && custom.name === bsVersion.name);

            if(customVersion){
                bsVersion.color = customVersion.color;
            }

            versions.push(bsVersion);
        };
        this.setCustomVersions(versions.filter(v => !!v.color));

        return versions;
   }

   public async deleteVersion(version: BSVersion): Promise<boolean>{
      if(version.steam || version.oculus){ return false; }
      const versionFolder = await this.getVersionPath(version);
      if(!this.utilsService.pathExist(versionFolder)){ return true; }

      return this.utilsService.deleteFolder(versionFolder)
         .then(() => { return true; })
         .catch(() => { return false; })
   }

   public async editVersion(version: BSVersion, name: string, color: string): Promise<BSVersion>{
      if(version.steam || version.oculus){ throw {title: "CantEditSteam", msg: "CantEditSteam"} as BsmException; }
      const oldPath = await this.getVersionPath(version);
      const editedVersion: BSVersion = version.BSVersion === name
         ? {...version, name: undefined, color}
         : {...version, name: this.removeSpecialChar(name), color};
      const newPath = await this.getVersionPath(editedVersion);

      if(oldPath === newPath){
         this.deleteCustomVersion(version);
         this.addCustomVersion(editedVersion);
         return editedVersion;
      }

      if(this.utilsService.pathExist(newPath) && newPath === oldPath){ throw {title: "VersionAlreadExist"} as BsmException; }

      return rename(oldPath, newPath).then(() => {
         this.deleteCustomVersion(version);
         this.addCustomVersion(editedVersion);
         return editedVersion;
      }).catch((err: Error) => {
         log.error("edit version error", err, version, name, color);
         throw {title: "CantRename", error: err} as BsmException;
      });
   }

   public async cloneVersion(version: BSVersion, name: string, color: string): Promise<BSVersion>{
      const originPath = await this.getVersionPath(version);
      const cloneVersion: BSVersion = version.BSVersion === name
         ? {...version, name: undefined, color}
         : {...version, name: this.removeSpecialChar(name), color, steam: false, oculus: false};
      const newPath = await this.getVersionPath(cloneVersion);

      if(originPath === newPath){
         this.deleteCustomVersion(version);
         this.addCustomVersion(cloneVersion);
      }

      if(this.utilsService.pathExist(newPath)){ throw {title: "VersionAlreadExist"} as BsmException; }

      return fs.copy(originPath, newPath, {dereference: true}).then(() => {
         this.addCustomVersion(cloneVersion);
         return cloneVersion;
      }).catch((err: Error) => {
         log.error("clone version error", err, version, name, color);
         throw {title: "CantClone", error: err} as BsmException
      })
   }

}
