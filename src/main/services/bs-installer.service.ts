import { BS_APP_ID, BS_DEPOT } from "../constants";
import path from "path";
import { BSVersion } from 'shared/bs-version.interface';
import { UtilsService } from "./utils.service";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import log from "electron-log";
import { InstallationLocationService } from "./installation-location.service";
import { ctrlc } from "ctrlc-windows";
import { BSLocalVersionService } from "./bs-local-version.service";

export class BSInstallerService{

  private static instance: BSInstallerService;

  private readonly utils: UtilsService;
  private readonly installLocationService: InstallationLocationService;
  private readonly localVersionService: BSLocalVersionService;

  private downloadProcess: ChildProcessWithoutNullStreams;

  private constructor(){
    this.utils =  UtilsService.getInstance();
    this.installLocationService = InstallationLocationService.getInstance();
    this.localVersionService = BSLocalVersionService.getInstance();
  }

  public static getInstance(){
    if(!BSInstallerService.instance){ BSInstallerService.instance = new BSInstallerService(); }
    return BSInstallerService.instance;
  }

  private getDepotDownloaderExePath(): string{
    return path.join(this.utils.getAssetsScriptsPath(), 'depot-downloader', 'DepotDownloader.exe');
  }

   private sendDownloadEvent(event: DownloadEventType, data?: string|number, success: boolean = true): void{
      if(typeof data === "string"){ data = data.replaceAll(/\[|\]/g, ""); }
      this.utils.ipcSend(`bs-download.${event}`, { success: success, data: data });
   }

  public sendInputProcess(input: string){
    if(this.downloadProcess.stdin.writable){
      this.downloadProcess.stdin.write(input+"\n");
    }
  }

   public killDownloadProcess(): Promise<boolean>{
      return new Promise(resolve => {
         if(this.downloadProcess?.killed && !this.downloadProcess?.pid){ return resolve(false); }

         this.downloadProcess.on('close', () => resolve(true));

         ctrlc(this.downloadProcess.pid);
         if(!this.downloadProcess.kill()){ return resolve(false); }
         setTimeout(() => resolve(false), 2000);
      });
   }

  public async downloadBsVersion(downloadInfos: DownloadInfo): Promise<DownloadEvent>{
    if(this.downloadProcess && !this.downloadProcess?.killed){ console.log("*** AlreadyDownloading ***"); return {type: "[AlreadyDownloading]"}; }
    const bsVersion = downloadInfos.bsVersion;
    if(!bsVersion){ return {type: "[Error]"}; }

    this.utils.createFolderIfNotExist(this.installLocationService.versionsDirectory);
    this.downloadProcess = spawn(
      this.getDepotDownloaderExePath(),
      [
        `-app ${BS_APP_ID}`,
        `-depot ${BS_DEPOT}`,
        `-manifest ${bsVersion.BSManifest}`,
        `-username ${downloadInfos.username}`,
        `-dir \"${this.localVersionService.getVersionFolder(bsVersion)}\"`,
        (downloadInfos.stay || !downloadInfos.password) && "-remember-password"
      ],
      {shell: true, cwd: this.installLocationService.versionsDirectory}
    );

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
            this.killDownloadProcess();
            resolve({type: "[Password]", data: bsVersion});
          }
          else if(out[0] === "[2FA]" as DownloadEventType || out[0] === "[Guard]" as DownloadEventType){
            this.sendDownloadEvent("[2FA]")
          }
          else if(out[0] === "[Progress]" as DownloadEventType || (out[0] === "[Validated]" as DownloadEventType && parseFloat(out[1]) < 100)){ 
            this.sendDownloadEvent("[Progress]", parseFloat(out[1].replaceAll(",", ".")));
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

      this.downloadProcess.on('close', (code) => reject({type: "[Exit]", data: code}));

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

export type DownloadEventType = "[Password]" | "[Guard]" | "[2FA]" | "[Progress]" | "[Validated]" | "[Finished]" | "[AlreadyDownloading]" | "[Error]" | "[Warning]" | "[SteamID]" | "[Exit]";
