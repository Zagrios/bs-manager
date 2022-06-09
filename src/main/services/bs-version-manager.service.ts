import { get } from 'https'
import { UtilsService } from './utils.service';
import path, { resolve } from 'path';
import { createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';

export class BSVersionManagerService{

  private static readonly REMOTE_BS_VERSIONS_URL: string = "https://raw.githubusercontent.com/Zagrios/bs-manager/master/assets/bs-versions.json"
  private static readonly VERSIONS_FILE: string = "bs-versions.json";

  private static instance: BSVersionManagerService;

  private utilsService: UtilsService;

  private bsVersions: BSVersion[] = [];

  private constructor(){
    this.utilsService = UtilsService.getInstance();
  }


  public static getInstance(): BSVersionManagerService{
    if(!BSVersionManagerService.instance){ BSVersionManagerService.instance = new BSVersionManagerService(); }
    return BSVersionManagerService.instance;
  }

  private getRemoteVersions(): Promise<BSVersion[]>{
    return new Promise<BSVersion[]>((resolve, reject) => {
      let body = ''
      get(BSVersionManagerService.REMOTE_BS_VERSIONS_URL, (res) => {
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          this.bsVersions = JSON.parse(body);
          resolve(this.bsVersions);
        });
        res.on('error', (err) => reject(null))
      })
    })
  }

  private async getLocalVersions(): Promise<BSVersion[]>{
    const localVersionsPath = path.join(this.utilsService.getAssetsPath(), BSVersionManagerService.VERSIONS_FILE);
    const rawVersion = (await this.utilsService.readFileAsync(localVersionsPath)).toString();
    return JSON.parse(rawVersion);
  }

  private async updateLocalVersions(versions: BSVersion[]): Promise<void>{
    const localVersionsPath = path.join(this.utilsService.getAssetsPath(), BSVersionManagerService.VERSIONS_FILE);
    writeFileSync(localVersionsPath, JSON.stringify(versions, null, "\t"), {encoding: 'utf-8', flag: 'w'});
  };

  public async loadBsVersions(): Promise<BSVersion[]>{
    if(this.bsVersions && this.bsVersions.length){ return this.bsVersions; }
    const [localVersions, remoteVersions] = await Promise.all([
      this.getLocalVersions(), this.getRemoteVersions()
    ]);
    let resVersions = localVersions;
    if(remoteVersions && remoteVersions.length){ resVersions = remoteVersions; this.updateLocalVersions(resVersions); }
    this.bsVersions = resVersions;
    return this.bsVersions;
  }

  public async getAvailableVersions(): Promise<BSVersion[]>{
    const bsVersions = await this.loadBsVersions();
    if(!bsVersions || !bsVersions.length){ return []; }
    return bsVersions;
    
  }

  public async getVersionOfBSFolder(bsPath: string): Promise<string>{
    const versionFilePath = path.join(bsPath, 'Beat Saber_Data', 'globalgamemanagers');
    if(!this.utilsService.pathExist(versionFilePath)){ return null; }
    const versionsAvailable = await this.getAvailableVersions();
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

  public getVersionDetailFromVersionNumber(version: string): BSVersion{
    return this.bsVersions.find(v => v.BSVersion === version);
  }

}

export interface BSVersion { BSVersion: string, BSManifest: string, ReleaseURL?: string, ReleaseImg?: string, ReleaseDate?: string, year: string, steam?: boolean }
