import { get } from 'https'
import { UtilsService } from './utils.service';
import path from 'path';
import { writeFileSync } from 'fs';
import { BSVersion } from 'shared/bs-version.interface';
import { RequestService } from "./request.service"
import isOnline from 'is-online';

export class BSVersionLibService{

   private readonly REMOTE_BS_VERSIONS_URL: string = "https://raw.githubusercontent.com/Zagrios/bs-manager/master/assets/jsons/bs-versions.json"
   private readonly VERSIONS_FILE: string = "bs-versions.json";

   private static instance: BSVersionLibService;

   private utilsService: UtilsService;
   private requestService: RequestService

   private bsVersions: BSVersion[] = [];

   private constructor(){
      this.utilsService = UtilsService.getInstance();
      this.requestService = RequestService.getInstance();
   }


   public static getInstance(): BSVersionLibService{
      if(!BSVersionLibService.instance){ BSVersionLibService.instance = new BSVersionLibService(); }
      return BSVersionLibService.instance;
   }

    private getRemoteVersions(): Promise<BSVersion[]>{
        return this.requestService.get<BSVersion[]>(this.REMOTE_BS_VERSIONS_URL);
    }

   private async getLocalVersions(): Promise<BSVersion[]>{
      const localVersionsPath = path.join(this.utilsService.getAssestsJsonsPath(), this.VERSIONS_FILE);
      const rawVersion = (await this.utilsService.readFileAsync(localVersionsPath)).toString();
      return JSON.parse(rawVersion);
   }

   private async updateLocalVersions(versions: BSVersion[]): Promise<void>{
      const localVersionsPath = path.join(this.utilsService.getAssestsJsonsPath(), this.VERSIONS_FILE);
      writeFileSync(localVersionsPath, JSON.stringify(versions, null, "\t"), {encoding: 'utf-8', flag: 'w'});
   };

   private async loadBsVersions(): Promise<BSVersion[]>{
      const [localVersions, remoteVersions] = await Promise.all([
         this.getLocalVersions(),  (await isOnline({timeout: 1500}) && this.getRemoteVersions())
      ]);
      let resVersions = localVersions;
      if(remoteVersions && remoteVersions.length){ resVersions = remoteVersions; this.updateLocalVersions(resVersions); }
      this.bsVersions = resVersions;
      return this.bsVersions;
   }

   public async getAvailableVersions(): Promise<BSVersion[]>{
      if(this.bsVersions && this.bsVersions.length){ return this.bsVersions; }
      const bsVersions = await this.loadBsVersions();
      if(!bsVersions || !bsVersions.length){ return []; }
      return bsVersions;
   }

   public getVersionDetails(version: string): BSVersion{
      return this.bsVersions.find(v => v.BSVersion === version);
   }

}