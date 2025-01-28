import { BSVersion } from "shared/bs-version.interface";
import { BbmFullMod, BbmMod, BbmModVersion, BbmPlatform } from "../../../shared/models/mods/mod.interface";
import { RequestService } from "../request.service";
import { BsStore } from "../../../shared/models/bs-store.enum";
import log from "electron-log"

export class BeatModsApiService {
    private static instance: BeatModsApiService;

    private readonly requestService: RequestService;

    public readonly MODS_REPO_URL = "https://beatmods.com";
    private readonly MODS_REPO_API_URL = `${this.MODS_REPO_URL}/api`;

    private readonly versionModsCache = new Map<string, BbmFullMod[]>();
    private readonly modsHashCache = new Map<string, BbmModVersion>();

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
        const platform: BbmPlatform = version.oculus || version.metadata?.store === BsStore.OCULUS ? BbmPlatform.OculusPC : BbmPlatform.SteamPC;
        return `${this.MODS_REPO_API_URL}/mods?status=verified&gameVersion=${version.BSVersion}&gameName=BeatSaber&platform=${platform}`;
    }

    private updateModsHashCache(mods: BbmModVersion[]): void {

        if(!Array.isArray(mods)){
            return;
        }

        for (const mod of mods) {
            for (const content of (mod.contentHashes ?? [])) {
                this.modsHashCache.set(content.hash, mod);
            }
        }
    }

    public async getVersionMods(version: BSVersion): Promise<BbmFullMod[]> {
        if (this.versionModsCache.has(version.BSVersion)) {
            return this.versionModsCache.get(version.BSVersion);
        }

        return this.requestService.getJSON<{ mods: {mod: BbmMod, latest: BbmModVersion}[] }>(this.getVersionModsUrl(version)).then(({ data }) => {
            const fullMods: BbmFullMod[] = data?.mods?.map(mod =>  ({ mod: mod.mod, version: mod.latest })) ?? [];
            this.versionModsCache.set(version.BSVersion, fullMods);

            this.updateModsHashCache(fullMods.map(mod => mod.version));

            return fullMods;
        });
    }

    public getModByHash(hash: string): Promise<BbmModVersion|undefined> {
        if (this.modsHashCache.has(hash)) {
            return Promise.resolve(this.modsHashCache.get(hash));
        }

        return this.requestService.getJSON<{ modVersions: BbmModVersion[] }>(`${this.MODS_REPO_API_URL}/hashlookup?hash=${hash}`).then(({ data }) => {
            this.updateModsHashCache(data?.modVersions ?? []);
            return data?.modVersions?.at(0);
        }).catch((e): undefined => {
            log.error(`Failed to get mod by hash: ${hash}`, e);
            return undefined;
        });
    }
}
