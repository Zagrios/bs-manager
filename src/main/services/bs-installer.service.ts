import { BS_APP_ID, BS_DEPOT } from "../constants";
import path from "path";
import { BSVersion, BSVersionManagerService } from "./bs-version-manager.service";
import { SteamService } from "./steam.service";
import { UtilsService } from "./utils.service";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import log from "electron-log";
import { InstallationLocationService } from "./installation-location.service";
import treeKill from "tree-kill";

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
    return path.join(this.utils.getAssetsScriptsPath(), 'depot-downloader', 'DepotDownloader.exe');
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

  private killDownloadProcess(){
    if(!this.downloadProcess?.connected || !this.downloadProcess?.pid){ return; }
    treeKill(this.downloadProcess.pid);
  }

  public async downloadBsVersion(downloadInfos: DownloadInfo): Promise<DownloadEvent>{
    if(this.downloadProcess?.connected){ return {type: "[AlreadyDownloading]"}; }
    const bsVersion = this.bsVersionService.getVersionDetailFromVersionNumber(downloadInfos.bsVersion.BSVersion);
    if(!bsVersion){ return {type: "[Error]"}; }

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

    return await new Promise((resolve, reject) => {

      this.downloadProcess.stdout.on('data', data => {
        const matched = (data.toString() as string).match(/(?:\[(.*?)\])\|(?:\[(.*?)\]\|)?(.*?)(?=$|\[)/gm) ?? [];
        console.log(data.toString());
        matched.forEach(match => {
          const out = match.split("|");
  
          if(out[0] === "[Password]" as DownloadEventType && downloadInfos.password){
            this.sendInputProcess(downloadInfos.password);
          }
          else if(out[0] === "[Password]" as DownloadEventType){
            treeKill(this.downloadProcess.pid);
            resolve({type: "[Password]", data: bsVersion});
          }
          else if(out[0] === "[2FA]" as DownloadEventType || out[0] === "[Guard]" as DownloadEventType){
            this.sendDownloadEvent("[2FA]")
          }
          else if(out[0] === "[Progress]" as DownloadEventType || (out[0] === "[Validated]" as DownloadEventType && parseFloat(out[1]) < 100)){ 
            this.sendDownloadEvent("[Progress]", parseFloat(out[1]));
          }
          else if(out[0] === "[Finished]" as DownloadEventType || (out[0] === "[Validated]" as DownloadEventType && parseFloat(out[1]) == 100)){
            resolve({type: "[Finished]"});
            this.killDownloadProcess();
          }
          else if(out[0] === "[SteamID]" as DownloadEventType){
            this.sendDownloadEvent("[SteamID]", out[1]);
          }
          else if(out[0] === "[Warning]" as DownloadEventType){
            this.sendDownloadEvent("[Warning]", out[1]);
          }
          else if(out[0] === "[Error]" as DownloadEventType){
            reject(out[1]);
            this.sendDownloadEvent("[Error]", out[1], false);
            this.killDownloadProcess();
            log.error("Download Event, Error", data.toString());
          }
        });
        
      })
  
      this.downloadProcess.stdout.on('error', (err) => {
        log.error("BS-DOWNLOAD ERROR", err.toString());
        this.downloadProcess.kill();
        reject(err);
      });
      this.downloadProcess.stderr.on('data', (err) => { 
        log.error("BS-DOWNLOAD ERROR", err.toString());
        this.downloadProcess.kill();
        reject(err);
      });
      this.downloadProcess.stderr.on('error', (err) => { 
        log.error("BS-DOWNLOAD ERROR", err.toString());
        this.downloadProcess.kill();
        reject(err);
      });

    })
  }

   private sendDownloadEvent(event: DownloadEventType, data?: string|number, success: boolean = true): void{
      if(typeof data === "string"){ data = data.replaceAll(/\[|\]/g, ""); }
      this.utils.newIpcSenc(`bs-download.${event}`, { success: success, data: data });
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

export type DownloadEventType = "[Password]" | "[Guard]" | "[2FA]" | "[Progress]" | "[Validated]" | "[Finished]" | "[AlreadyDownloading]" | "[Error]" | "[Warning]" | "[SteamID]";
