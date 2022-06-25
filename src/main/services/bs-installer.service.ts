import { BS_APP_ID, BS_DEPOT } from "../constants";
import path from "path";
import { BSVersion, BSVersionManagerService } from "./bs-version-manager.service";
import { SteamService } from "./steam.service";
import { UtilsService } from "./utils.service";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import log from "electron-log";
import { InstallationLocationService } from "./installation-location.service";

export class BSInstallerService{

  private static readonly INSTALLATION_FOLDER = "BSInstances";

  private static instance: BSInstallerService;

  private readonly utils: UtilsService;
  private readonly steamService: SteamService;
  private readonly bsVersionService: BSVersionManagerService;
  private readonly installLocationService: InstallationLocationService;

  private downloadProcess: ChildProcessWithoutNullStreams;

  private constructor(){
    this.bsVersionService = BSVersionManagerService.getInstance();
    this.utils =  UtilsService.getInstance();
    this.steamService = SteamService.getInstance();
    this.installLocationService = InstallationLocationService.getInstance();
  }

  public get installationFolder(): string{
    return path.join(this.installLocationService.installationDirectory, BSInstallerService.INSTALLATION_FOLDER);
  }

  public static getInstance(){
    if(!BSInstallerService.instance){ BSInstallerService.instance = new BSInstallerService(); }
    return BSInstallerService.instance;
  }

  private getDepotDownloaderExePath(): string{
    return path.join(this.utils.getAssetsPath(), 'depot-downloader', 'DepotDownloader.exe');
  }

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

    if(!this.utils.folderExist(this.installationFolder)){ return versions }

    const folderInInstallation = this.utils.listDirsInDir(this.installationFolder);

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

    this.utils.createFolderIfNotExist(this.installationFolder);
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
      {shell: true, cwd: this.installationFolder}
    )

    this.downloadProcess.stdout.on('data', async (data) => {
      log.info("DL PROCESS OUT " ,data.toString());
      const matched = (data.toString() as string).match(/(?:\[(.*?)\])\|(?:\[(.*?)\]\|)?(.*?)(?=$|\[)/gm);
      if(!matched || !matched.length){ return; }

      matched.forEach(match => {
        const out = match.split("|");

        if(out[0] === DownloadEventType.NOT_LOGGED_IN && downloadInfos.password){
          this.sendInputProcess(downloadInfos.password);
        }
        else if(out[0] === DownloadEventType.NOT_LOGGED_IN){
          this.downloadProcess.kill();
          this.utils.ipcSend(`bs-download.${DownloadEventType.NOT_LOGGED_IN}`, bsVersion);
        }
        else if(out[0] === DownloadEventType.GUARD_CODE){
          this.utils.ipcSend(`bs-download.${DownloadEventType.GUARD_CODE}`);
        }
        else if(out[0] === DownloadEventType.TWO_FA_CODE){
          this.utils.ipcSend(`bs-download.${DownloadEventType.GUARD_CODE}`);
        }
        else if(out[0] === DownloadEventType.PROGESS || (out[0] === DownloadEventType.VALIDATION && parseFloat(out[1]) < 100)){ 
          this.utils.ipcSend(`bs-download.${DownloadEventType.PROGESS}`, parseFloat(out[1])); 
        }
        else if(out[0] === DownloadEventType.FINISH || (out[0] === DownloadEventType.VALIDATION && parseFloat(out[1]) == 100)){ 
          this.utils.ipcSend(`bs-download.${DownloadEventType.FINISH}`); this.downloadProcess.kill(); 
        }
        else if(out[0] === DownloadEventType.ERROR){
          this.utils.ipcSend(`bs-download.${DownloadEventType.ERROR}`);
          log.error("Download Event, Error", data.toString())
        }
      });
      
    })

    this.downloadProcess.stdout.on('error', (err) => {
      log.error("BS-DOWNLOAD ERROR", err.toString());
      this.utils.ipcSend(`bs-download.${DownloadEventType.ERROR}`); 
    });
    this.downloadProcess.stderr.on('data', (err) => { 
      log.error("BS-DOWNLOAD ERROR", err.toString());
      this.utils.ipcSend(`bs-download.${DownloadEventType.ERROR}`); 
    });
    this.downloadProcess.stderr.on('error', (err) => { 
      log.error("BS-DOWNLOAD ERROR", err.toString());
      this.utils.ipcSend(`bs-download.${DownloadEventType.ERROR}`); 
    });
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
  VALIDATION = "[Validated]",
  FINISH = "[Finished]",
  ALREADY_DOAWNLOADING = "[AlreadyDownloading]",
  ERROR = "[Error]",
}
