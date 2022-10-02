import { BSVersion } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods/mod.interface";
import { RequestService } from "../request.service";

export class BeatModsApiService {

    private static instance: BeatModsApiService;

    private readonly requestService: RequestService;

    private readonly BEAT_MODS_VERSIONS = "https://versions.beatmods.com/versions.json";
    private readonly BEAT_MODS_ALIAS = "https://alias.beatmods.com/aliases.json";

    private readonly BEAT_MODS_API_URL = "https://beatmods.com/api/v1/";
    public readonly BEAT_MODS_URL = "https://beatmods.com";

    private readonly aliasesCache = new Map<string, BSVersion[]>();
    private readonly versionModsCache = new Map<string, Mod[]>();

    private allModsCache: Mod[];

    public static getInstance(): BeatModsApiService{
        if(!BeatModsApiService.instance){ BeatModsApiService.instance = new BeatModsApiService(); }
        return BeatModsApiService.instance;
    }

    private constructor(){
        this.requestService = RequestService.getInstance();
    }

    private getVersionModsUrl(version: BSVersion): string{
        return `${this.BEAT_MODS_API_URL}mod?status=approved&gameVersion=${version.BSVersion}&sort=&sortDirection=1`;
    }

    private getAllModsUrl(): string{
        return `${this.BEAT_MODS_API_URL}mod`;
    }

    private async getVersionAlias(): Promise<Map<string, BSVersion[]>>{
        if(this.aliasesCache.size){ return this.aliasesCache; }
        return this.requestService.get<Record<string, string[]>>(this.BEAT_MODS_ALIAS).then(rawAliases => {
            Object.entries(rawAliases).forEach(([key, value]) => {
                this.aliasesCache.set(key, value.map(s => ({BSVersion: s} as BSVersion)));
            });
            return this.aliasesCache;
        })
    }

    private async getAliasOfVersion(version: BSVersion): Promise<BSVersion>{
        return this.getVersionAlias().then(aliases => {
            if(Array.from(aliases.keys()).some(k => k === version.BSVersion)){ return version; }
            const alias = Array.from(aliases.entries()).find(([key, value]) => value.find(v => v.BSVersion === version.BSVersion))[0];
            return {BSVersion: alias} as BSVersion
        });
    }

    private asignDependencies(mod: Mod, mods: Mod[]): Mod{
        mod.dependencies = mod.dependencies.map(dep => mods.find(mod => mod.name === dep.name));
        return mod;
    }

    public async getVersionMods(version: BSVersion): Promise<Mod[]>{
        if(this.versionModsCache.has(version.BSVersion)){ return this.versionModsCache.get(version.BSVersion); }

        const alias = await this.getAliasOfVersion(version);

        return this.requestService.get<Mod[]>(this.getVersionModsUrl(alias)).then(mods => {
            mods = mods.map(mod => this.asignDependencies(mod, mods));
            this.versionModsCache.set(version.BSVersion, mods);
            return mods;
        });
    }

    public async getAllMods(): Promise<Mod[]>{
        if(!!this.allModsCache){ return this.allModsCache; }
        return this.requestService.get<Mod[]>(this.getAllModsUrl()).then(mods => {
            this.allModsCache = mods;
            return this.allModsCache;
        });
    }

    public loadAllMods(){ return this.getAllMods(); }





}