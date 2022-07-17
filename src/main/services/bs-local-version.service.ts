import { BSVersion, BSVersionManagerService } from "./bs-version-manager.service";
import { InstallationLocationService } from "./installation-location.service";
import { SteamService } from "./steam.service";
import { UtilsService } from "./utils.service";
import { BS_APP_ID } from "../constants";
import path from "path";
import { createInterface } from "readline";
import { createReadStream } from "fs";

export class BSLocalVersionService{

   private static instance: BSLocalVersionService;

   private readonly installLocationService: InstallationLocationService;
   private readonly utilsService: UtilsService;
   private readonly steamService: SteamService;
   private readonly remoteVersionService: BSVersionManagerService;

   public static getInstance(): BSLocalVersionService{
      if(!BSLocalVersionService.instance){ BSLocalVersionService.instance = new BSLocalVersionService(); }
      return BSLocalVersionService.instance;
   }

   private constructor(){
      this.installLocationService = InstallationLocationService.getInstance();
      this.utilsService = UtilsService.getInstance();
      this.steamService = SteamService.getInstance();
      this.remoteVersionService = BSVersionManagerService.getInstance();
   }

   private async getVersionOfBSFolder(bsPath: string): Promise<string>{
      const versionFilePath = path.join(bsPath, 'Beat Saber_Data', 'globalgamemanagers');
      if(!this.utilsService.pathExist(versionFilePath)){ return null; }
      const versionsAvailable = await this.remoteVersionService.getAvailableVersions();
      return new Promise<string>(async (resolve, reject) => { 
         const readLine = createInterface({ input: createReadStream(versionFilePath) });
         let findVersion: string = null;
         readLine.on('line', (line) => {
            for(const version of versionsAvailable){
               if(line.includes(version.BSVersion)){ findVersion = version.BSVersion; readLine.close(); }
            }
         });
         readLine.on('close', () => {
            if(findVersion){ resolve(findVersion) }
            resolve(findVersion);
         });
      })
   }

   public async getInstalledVersions(): Promise<BSVersion[]>{
      const versions: BSVersion[] = [];
      const steamBsFolder = await this.steamService.getGameFolder(BS_APP_ID, "Beat Saber")
      if(steamBsFolder && this.utilsService.pathExist(steamBsFolder)){
         const steamBsVersion = await this.getVersionOfBSFolder(steamBsFolder);
         if(steamBsVersion){
           const steamVersionDetails = this.remoteVersionService.getVersionDetailFromVersionNumber(steamBsVersion);
           versions.push(steamVersionDetails ? {...steamVersionDetails, steam: true} : {BSVersion: steamBsVersion, steam: true});
         }
      }

      if(!this.utilsService.folderExist(this.installLocationService.versionsDirectory)){ return versions }

      const folderInInstallation = this.utilsService.listDirsInDir(this.installLocationService.versionsDirectory);

      folderInInstallation.forEach(f => {
         const version = this.remoteVersionService.getVersionDetailFromVersionNumber(f);
         versions.push(version);
      })
      return versions;
   }

   public async deleteVersion(version: BSVersion): Promise<boolean>{
      if(version.steam){ return false; }
      const versionFolder = path.join(this.installLocationService.versionsDirectory, version.BSVersion);
      if(!this.utilsService.folderExist(versionFolder)){ return true; }

      return this.utilsService.deleteFolder(versionFolder)
         .then(() => { return true; })
         .catch(() => { return false; })
   }

   public cloneVersion(version: BSVersion, name: string): boolean{
      return true;
   }

}