import { BSVersionLibService } from "./bs-version-lib.service";
import { BSVersion } from 'shared/bs-version.interface';
import { InstallationLocationService } from "./installation-location.service";
import { SteamService } from "./steam.service";
import { UtilsService } from "./utils.service";
import { BS_APP_ID, OCULUS_BS_DIR } from "../constants";
import path from "path";
import { createInterface } from "readline";
import { createReadStream } from "fs";
import fs from "fs-extra";
import { ConfigurationService } from "./configuration.service";
import { rename } from "fs/promises";
import { BsmException } from "shared/models/bsm-exception.model";
import log from "electron-log";
import { OculusService } from "./oculus.service";
import { DownloadLinkType } from "shared/models/mods";

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

   private async getVersionOfBSFolder(bsPath: string): Promise<string>{
      const versionFilePath = path.join(bsPath, 'Beat Saber_Data', 'globalgamemanagers');
      if(!this.utilsService.pathExist(versionFilePath)){ return null; }
      const versionsAvailable = await this.remoteVersionService.getAvailableVersions();
      return new Promise<string>(resolve => {
         const readLine = createInterface({ input: createReadStream(versionFilePath) });
         let findVersion: string = null;
         readLine.on('line', (line) => {
            for(const version of versionsAvailable){
               if(line.includes(version.BSVersion)){
                    findVersion = version.BSVersion;
                    readLine.close();
                    break;
                }
            }
         });
         readLine.on('close', () => {
            if(findVersion){ resolve(findVersion) }
            resolve(findVersion);
         });
      })
   }

   private setCustomVersions(versions: BSVersion[]): void{
      this.configService.set(this.CUSTOM_VERSIONS_KEY, versions,this.CUSTOM_VERSIONS_KEY,this.installLocationService.installationDirectory);
   }

   private addCustomVersion(version: BSVersion): void{
      this.setCustomVersions([...this.getCustomVersions() ?? [], version]);
   }

   private getCustomVersions(): BSVersion[]{
      return this.configService.get<BSVersion[]>(this.CUSTOM_VERSIONS_KEY,this.CUSTOM_VERSIONS_KEY) || [];
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
      return seq.replace( /[<>:"\/\\|?*]+/g, '' );
   }

    public getVersionFolder(version: BSVersion){
        return version.name ? `${version.BSVersion}-${version.name}` : version.BSVersion;
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
        const version = await this.remoteVersionService.getVersionDetails(steamBsVersion);
        if(!version){ return null; }
        return {...version, steam: true};
    }

    private async getOculusVersion(): Promise<BSVersion>{
        const oculusBsFolder = await this.oculusService.getGameFolder(OCULUS_BS_DIR);
        if(!oculusBsFolder){ return null; }
        const oculusBsVersion = await this.getVersionOfBSFolder(oculusBsFolder);
        if(!oculusBsVersion){ return null; }
        const version = await this.remoteVersionService.getVersionDetails(oculusBsVersion);
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

      const folderInInstallation = this.utilsService.listDirsInDir(this.installLocationService.versionsDirectory);
      for(const f of folderInInstallation){
         log.info("try get version from folder", f);
         let version = await this.remoteVersionService.getVersionDetails(f);
         if(version){ version = this.getCustomVersions().find(v => v.BSVersion === version.BSVersion && v.name === version.name) ?? version; }
         else { version = this.getCustomVersions().find(v => {
               const [version, ...rest] = f.split("-");
               if(rest.length < 1){ return false; }
               const name = rest.join("-");
               return name === v.name && version === v.BSVersion;
            })
         }
         version && versions.push(version);
      };
      this.setCustomVersions(versions.filter(v => !!v.name || !!v.color));
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

      if(this.utilsService.pathExist(newPath)){ throw {title: "VersionAlreadExist"} as BsmException; }

      return rename(oldPath, newPath).then(() => {
         this.deleteCustomVersion(version);
         this.addCustomVersion(editedVersion);
         return editedVersion;
      }).catch((err: Error) => {
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
         return cloneVersion;
      }

      if(this.utilsService.pathExist(newPath)){ throw {title: "VersionAlreadExist"} as BsmException; }

      return fs.copy(originPath, newPath).then(() => {
         this.addCustomVersion(cloneVersion);
         return cloneVersion;
      }).catch((err: Error) => {
         throw {title: "CantClone", error: err} as BsmException
      })
   }

}
