import { BSVersion } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods/mod.interface";
import { RequestService } from "../request.service";

export class BeatModsApiService {
    private static instance: BeatModsApiService;

    private readonly requestService: RequestService;

    public readonly MODS_REPO_URL = "https://bbm.saera.gay";
    private readonly BEAT_MODS_API_URL = `${this.MODS_REPO_URL}/api`;

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

    private convertToBeatModsMod(mod: Mod): Mod {

    }

    private getVersionModsUrl(version: BSVersion): string {
        return `${this.BEAT_MODS_API_URL}/mods?status=verified&gameVersion=${version.BSVersion}`;
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

        return this.requestService.getJSON<Mod[]>(this.getVersionModsUrl(version)).then(mods => {
            mods = mods.map(mod => this.asignDependencies(mod, mods));
            this.versionModsCache.set(version.BSVersion, mods);

            this.updateModsHashCache(mods);

            return mods;
        });
    }

    public getModByHash(hash: string): Promise<Mod> {
        if (this.modsHashCache.has(hash)) {
            return Promise.resolve(this.modsHashCache.get(hash));
        }

        return this.requestService.getJSON<Mod[]>(`${this.BEAT_MODS_API_URL}/hashlookup?hash=${hash}`).then(mods => {
            this.updateModsHashCache(mods);
            return mods.at(0);
        });
    }
}
