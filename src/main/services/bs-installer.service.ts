import { BS_APP_ID, BS_DEPOT } from "../constants";
import path from "path";
import { BSVersion, BSVersionManagerService } from "./bs-version-manager.service";
import { SteamService } from "./steam.service";
import { UtilsService } from "./utils.service";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import treeKill from "tree-kill";

export class BSInstallerService{

  private static readonly INSTALLATION_FOLDER = path.join("BSManager", "BSInstances");

  private static instance: BSInstallerService;

  private readonly utils: UtilsService = UtilsService.getInstance();
  private readonly steamService: SteamService = SteamService.getInstance();
  private readonly bsVersionService: BSVersionManagerService = BSVersionManagerService.getInstance();

  private downloadProcess: ChildProcessWithoutNullStreams;

  private installationFolder: string;

  private constructor(){
    this.installationFolder = path.join(this.utils.getUserDocumentsFolder(), BSInstallerService.INSTALLATION_FOLDER)
  }

  public static getInstance(){
    if(!BSInstallerService.instance){ BSInstallerService.instance = new BSInstallerService(); }
    return BSInstallerService.instance;
  }

  private getDepotDownloaderExePath(): string{
    return path.join(this.utils.getAssetsPath(), 'depot-downloader', 'DepotDownloader.exe');
  }

  public getBSInstallationFolder(): string{ return this.installationFolder; }
  public setBSInstallationFolder(path: string){ this.installationFolder = path; }

  public async getInstalledBsVersion(): Promise<BSVersion[]>{
    const versions: BSVersion[] = [];
    const steamBsFolder = await this.steamService.getGameFolder(BS_APP_ID, "Beat Saber")
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

  public sendInputProcess(input: string){
    if(this.downloadProcess.stdin.writable){
      this.downloadProcess.stdin.write(input+"\n");
    }
  }

  public downloadBsVersion(downloadInfos: DownloadInfo){
    if(this.downloadProcess?.connected){ this.utils.ipcSend(`bs-download.${DownloadEventType.ALREADY_DOAWNLOADING}`); return; }

    const bsVersion = this.bsVersionService.getVersionDetailFromVersionNumber(downloadInfos.bsVersion.BSVersion);
    if(!bsVersion){ this.utils.ipcSend(`bs-download.${DownloadEventType.ERROR}`); return; }

    this.utils.createFolderIfNotExist(this.getBSInstallationFolder());
    console.log(this.getDepotDownloaderExePath())
    this.downloadProcess = spawn(
      this.getDepotDownloaderExePath(),
      [
        `-app ${BS_APP_ID}`,
        `-depot ${BS_DEPOT}`,
        `-manifest ${bsVersion.BSManifest}`,
        `-username ${downloadInfos.username}`,
        `-dir ${bsVersion.BSVersion}`,
        (downloadInfos.stay || !downloadInfos.password) && "-remember-password"
      ],
      {shell: true, cwd: this.getBSInstallationFolder()}
    )

    this.downloadProcess.stdout.on('data', async (data) => {
      const matched = (data.toString() as string).match(/(?:\[(.*?)\])\|(?:\[(.*?)\]\|)?(.*?)(?=$|\[)/gm);
      if(!matched || !matched.length){ return; }

      matched.forEach(match => {
        console.log(match);
        const out = match.split("|");

        if(out[0] === DownloadEventType.NOT_LOGGED_IN && downloadInfos.password){ setTimeout(() => {this.sendInputProcess(downloadInfos.password); console.log("*** LOGIN ***")}, 5000) }
        else if(out[0] === DownloadEventType.NOT_LOGGED_IN){ this.downloadProcess.kill(); this.utils.ipcSend(`bs-download.${DownloadEventType.NOT_LOGGED_IN}`); }
        else if(out[0] === DownloadEventType.GUARD_CODE){ this.utils.ipcSend(`bs-download.${DownloadEventType.GUARD_CODE}`); }
        else if(out[0] === DownloadEventType.TWO_FA_CODE){ this.utils.ipcSend(`bs-download.${DownloadEventType.TWO_FA_CODE}`); }
        else if(out[0] === DownloadEventType.PROGESS){ this.utils.ipcSend(`bs-download.${DownloadEventType.PROGESS}`, parseFloat(out[1])); }
        else if(out[0] === DownloadEventType.FINISH){ this.utils.ipcSend(`bs-download.${DownloadEventType.FINISH}`); this.downloadProcess.kill(); }
        else if(out[0] === DownloadEventType.ERROR){
          console.log("ERROR");
          this.utils.ipcSend(`bs-download.${DownloadEventType.ERROR}`);
        }
      });
      
    })

    this.downloadProcess.stdout.on('error', err => {
      console.log(err.toString());
      this.utils.ipcSend(`bs-download.${DownloadEventType.ERROR}`);
    })

    this.downloadProcess.stderr.on('data', err => {
      console.log(err.toString());
      console.log("a");
      this.utils.ipcSend(`bs-download.${DownloadEventType.ERROR}`);
    })

    this.downloadProcess.stderr.on('error', err => {
      console.log(err.toString());
      console.log("b");
      this.utils.ipcSend(`bs-download.${DownloadEventType.ERROR}`);
    })
  }

}




export interface DownloadInfo {
  bsVersion: BSVersion,
  username: string,
  password?: string,
  stay?: boolean
}

export interface DownloadEvent{
  type: DownloadEventType,
  data?: any,
}

export enum DownloadEventType{
  NOT_LOGGED_IN = "[Password]",
  GUARD_CODE = "[Guard]",
  TWO_FA_CODE = "[2FA]",
  PROGESS = "[Progress]",
  FINISH = "[Finished]",
  ALREADY_DOAWNLOADING = "[AlreadyDownloading]",
  ERROR = "[Error]",
}
