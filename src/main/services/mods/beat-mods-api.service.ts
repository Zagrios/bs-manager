import { BSVersion } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods/mod.interface";
import { RequestService } from "../request.service";

export class BeatModsApiService {
    private static instance: BeatModsApiService;

    private readonly requestService: RequestService;

    private readonly BEAT_MODS_ALIAS = "https://alias.beatmods.com/aliases.json";

    private readonly BEAT_MODS_API_URL = "https://beatmods.com/api/v1/";
    public readonly BEAT_MODS_URL = "https://beatmods.com";

    private readonly aliasesCache = new Map<string, BSVersion[]>();
    private readonly versionModsCache = new Map<string, Mod[]>();
    private readonly modsHashCache = new Map<string, Mod>();

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

    private async getVersionAlias(): Promise<Map<string, BSVersion[]>> {
        if (this.aliasesCache.size) {
            return this.aliasesCache;
        }
        return this.requestService.getJSON<Record<string, string[]>>(this.BEAT_MODS_ALIAS).then(rawAliases => {
            Object.entries(rawAliases).forEach(([key, value]) => {
                this.aliasesCache.set(
                    key,
                    value.map(s => ({ BSVersion: s } as BSVersion))
                );
            });
            return this.aliasesCache;
        });
    }

    private async getAliasOfVersion(version: BSVersion): Promise<BSVersion> {
        return this.getVersionAlias().then(aliases => {
            if (Array.from(aliases.keys()).some(k => k === version.BSVersion)) {
                return version;
            }
            const alias = Array.from(aliases.entries()).find(([, value]) => value.find(v => v.BSVersion === version.BSVersion))?.[0];
            return { BSVersion: alias } as BSVersion;
        });
    }

    private asignDependencies(mod: Mod, mods: Mod[]): Mod {
        mod.dependencies = mod.dependencies.map(dep => mods.find(mod => mod.name === dep.name));
        return mod;
    }

    private updateModsHashCache(mods: Mod[]): void {

        if(!Array.isArray(mods)){
            return;
        }

        for (const mod of mods) {
            for (const downloads of (mod.downloads ?? [])) {
                for (const hashMd5 of (downloads.hashMd5 ?? [])) {
                    this.modsHashCache.set(hashMd5.hash, mod);
                }
            }

            for (const dep of (mod.dependencies ?? [])) {
                for (const downloads of (dep.downloads ?? [])) {
                    for (const hashMd5 of (downloads.hashMd5 ?? [])) {
                        this.modsHashCache.set(hashMd5.hash, dep);
                    }
                }
            }
        }
    }

    public async getVersionMods(version: BSVersion): Promise<Mod[]> {
        if (this.versionModsCache.has(version.BSVersion)) {
            return this.versionModsCache.get(version.BSVersion);
        }

        const alias = await this.getAliasOfVersion(version);

        return this.requestService.getJSON<Mod[]>(this.getVersionModsUrl(alias)).then(mods => {
            mods = mods.map(mod => this.asignDependencies(mod, mods));
            this.versionModsCache.set(version.BSVersion, mods);

            this.updateModsHashCache(mods);

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

    public getModByHash(hash: string): Promise<Mod> {
        if (this.modsHashCache.has(hash)) {
            return Promise.resolve(this.modsHashCache.get(hash));
        }

        return this.requestService.getJSON<Mod[]>(`${this.BEAT_MODS_API_URL}mod?hash=${hash}`).then(mods => {
            this.updateModsHashCache(mods);
            return mods.at(0);
        });
    }
}
