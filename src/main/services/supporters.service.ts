import { writeFileSync } from "fs";
import { get } from "https";
import isOnline from "is-online";
import path from "path";
import { Supporter } from "shared/models/supporters/supporter.interface";
import { UtilsService } from "./utils.service";

export class SupportersService {

    private readonly PATREONS_URL = "https://raw.githubusercontent.com/Zagrios/bs-manager/master/assets/jsons/patreons.json"
    private readonly PATREONS_FILE = "patreons.json";

    private static instance: SupportersService;

    private cache: Supporter[];

    private readonly utilsService: UtilsService;

    public static getInstance(): SupportersService{
        if(!SupportersService.instance){ SupportersService.instance = new SupportersService(); }
        return SupportersService.instance;
    }

    private constructor(){
        this.utilsService = UtilsService.getInstance();
    }

    private async updateLocalSupporters(supporters: Supporter[]): Promise<void>{
        const patreonsPath = path.join(this.utilsService.getAssestsJsonsPath(), this.PATREONS_FILE);
        writeFileSync(patreonsPath, JSON.stringify(supporters, null, "\t"), {encoding: 'utf-8', flag: 'w'});
    }

    private async getRemoteSupporters(): Promise<Supporter[]>{
        return new Promise<Supporter[]>((resolve, reject) => {
            let body = ''
            get(this.PATREONS_URL, (res) => {
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve(JSON.parse(body)));
                res.on('error', () => reject(null))
            })
         })
    }

    private async getLocalSupporters(): Promise<Supporter[]>{
        const patreonsPath = path.join(this.utilsService.getAssestsJsonsPath(), this.PATREONS_FILE);
        const rawPatreons = (await this.utilsService.readFileAsync(patreonsPath)).toString();
        return JSON.parse(rawPatreons);
    }

    private async loadSupporters(): Promise<Supporter[]>{
        if(!!this.cache && this.cache.length){ return this.cache; }

        const isOnlineRes = await isOnline({timeout: 1500});

        const [localVersions, remoteVersions] = await Promise.all([
            this.getLocalSupporters(),  (isOnlineRes && this.getRemoteSupporters())
        ]);
        
        const supporters = remoteVersions?.length ? remoteVersions : localVersions;

        if(!!remoteVersions && remoteVersions.length){ this.updateLocalSupporters(remoteVersions); }

        this.cache = supporters;
        return this.cache;
    }

    public getSupporters(): Promise<Supporter[]>{
        return this.loadSupporters();
    }

}