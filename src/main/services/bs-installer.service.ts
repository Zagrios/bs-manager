import { BS_APP_ID } from "../constants";
import path from "path";
import { BSVersion, BSVersionManagerService } from "./bs-version-manager.service";
import { SteamService } from "./steam.service";
import { UtilsService } from "./utils.service";

export class BSInstallerService{

  private static readonly INSTALLATION_FOLDER = path.join("BSManager", "BSInstances");

  private static instance: BSInstallerService;

  private readonly utils: UtilsService = UtilsService.getInstance();
  private readonly steamService: SteamService = SteamService.getInstance();
  private readonly bsVersionService: BSVersionManagerService = BSVersionManagerService.getInstance();

  private installationFolder: string;

  private constructor(){
    this.installationFolder = path.join(this.utils.getUserDocumentsFolder(), BSInstallerService.INSTALLATION_FOLDER)
  }

  public static getInstance(){
    if(!BSInstallerService.instance){ BSInstallerService.instance = new BSInstallerService(); }
    return BSInstallerService.instance;
  }

  public getBSInstallationFolder(): string{ return this.installationFolder; }
  public setBSInstallationFolder(path: string){ this.installationFolder = path; }

  public async getInstalledBsVersion(): Promise<BSVersion[]>{
    const versions: BSVersion[] = [];
    console.log("aaa");
    const steamBsFolder = await this.steamService.getGameFolder(BS_APP_ID, "Beat Saber")
    console.log(steamBsFolder);
    if(steamBsFolder && this.utils.pathExist(steamBsFolder)){
      const steamBsVersion = await this.bsVersionService.getVersionOfBSFolder(steamBsFolder);
      if(steamBsVersion){
        const steamVersionDetails = this.bsVersionService.getVersionDetailFromVersionNumber(steamBsVersion);
        versions.push(steamVersionDetails ? {...steamVersionDetails, steam: true} : {BSVersion: steamBsVersion, steam: true});
      }
    }

    if(!this.utils.folderExist(this.getBSInstallationFolder())){ return versions }

    const folderInInstallation = this.utils.listDirsInDir(this.getBSInstallationFolder());

    folderInInstallation.forEach(f => {
      const version = this.bsVersionService.getVersionDetailFromVersionNumber(f);
      versions.push(version);
    })

    return versions;
  }

}
