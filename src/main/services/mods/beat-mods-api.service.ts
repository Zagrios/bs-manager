import { BSVersion, BSVersionString } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods/mod.interface";
import { RequestService } from "../request.service";

export class BeatModsApiService {
    private static instance: BeatModsApiService;

    private readonly requestService: RequestService;

    private readonly BEAT_MODS_ALIAS = "https://alias.beatmods.com/aliases.json";

    private readonly BEAT_MODS_API_URL = "https://beatmods.com/api/v1/";
    public readonly BEAT_MODS_URL = "https://beatmods.com";

    private aliasesCache: Record<BSVersionString, BSVersionString[]> = {};
    private readonly versionModsCache = new Map<BSVersionString, Mod[]>();

    private allModsCache: Mod[];

    public static getInstance(): BeatModsApiService {
        if (!BeatModsApiService.instance) {
            BeatModsApiService.instance = new BeatModsApiService();
        }
        return BeatModsApiService.instance;
    }

    private constructor() {
        this.requestService = RequestService.getInstance();
    }

    private getVersionModsUrl(version: BSVersion): string {
        return `${this.BEAT_MODS_API_URL}mod?status=approved&gameVersion=${version.BSVersion}&sort=&sortDirection=1`;
    }

    private getAllModsUrl(): string {
        return `${this.BEAT_MODS_API_URL}mod`;
    }

    public async getVersionAliases(): Promise<Record<BSVersionString, BSVersionString[]>> {
        if (Object.keys(this.aliasesCache).length > 0) {
            return this.aliasesCache;
        }

        return this.requestService.getJSON<Record<BSVersionString, BSVersionString[]>>(this.BEAT_MODS_ALIAS).then(rawAliases => {
            this.aliasesCache = rawAliases;
            return this.aliasesCache;
        });
    }

    private async getAliasOfVersion(version: BSVersionString): Promise<BSVersionString> {
        return this.getVersionAliases().then(aliases => (
            aliases[version] ? version : Object.keys(aliases).find(k => aliases[k as BSVersionString].some(v => v === version)) as BSVersionString
        ));
    }

    private asignDependencies(mod: Mod, mods: Mod[]): Mod {
        mod.dependencies = mod.dependencies.map(dep => mods.find(mod => mod.name === dep.name));
        return mod;
    }

    public async getVersionMods(version: BSVersionString): Promise<Mod[]> {
        if (this.versionModsCache.has(version)) {
            return this.versionModsCache.get(version);
        }

        const alias = await this.getAliasOfVersion(version);

        return this.requestService.getJSON<Mod[]>(this.getVersionModsUrl({ BSVersion: alias })).then(mods => {
            mods = mods.map(mod => this.asignDependencies(mod, mods));
            this.versionModsCache.set(version, mods);
            return mods;
        });
    }

    public async getAllMods(): Promise<Mod[]> {
        if (this.allModsCache) {
            return this.allModsCache;
        }
        return this.requestService.getJSON<Mod[]>(this.getAllModsUrl()).then(mods => {
            this.allModsCache = mods;
            return this.allModsCache;
        });
    }
}
