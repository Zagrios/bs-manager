import { get } from 'https'

export class BSVersionManagerService{

  private static readonly REMOTE_BS_VERSIONS_URL: string = "https://raw.githubusercontent.com/Zagrios/bs-manager/master/dynamic-resources/bs-versions.json"

  private static instance: BSVersionManagerService;

  private bsVersions: BSVersion[] = [];

  private constructor(){}

  public static getInstance(): BSVersionManagerService{
    if(!BSVersionManagerService.instance){ BSVersionManagerService.instance = new BSVersionManagerService() }
    return BSVersionManagerService.instance;
  }

  public loadBsVersions(): Promise<BSVersion[]>{
    return new Promise<BSVersion[]>((resolve, reject) => {
      let body = ''
      get(BSVersionManagerService.REMOTE_BS_VERSIONS_URL, (res) => {
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          this.bsVersions = JSON.parse(body);
          resolve(this.bsVersions);
        });
        res.on('error', (err) => reject(err))
      })
    })
  }

  public getVersionDetailFromVersionNumber(version: string): BSVersion{
    return this.bsVersions.find(v => v.BSVersion === version);
  }

}

export interface BSVersion { BSVersion: string, BSManifest: string, ReleaseURL: string, year: string }
