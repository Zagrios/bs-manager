import { BSVersion } from "shared/bs-version.interface";
import { BbmFullMod, BbmMod, BbmModVersion, BbmPlatform } from "../../../shared/models/mods/mod.interface";
import { RequestService } from "../request.service";
import { BsStore } from "../../../shared/models/bs-store.enum";
import log from "electron-log"
import { StaticConfigurationService } from "../static-configuration.service";
import { ModRepo } from "shared/models/mods/repo.model";

export class BeatModsApiService {
    private static instance: BeatModsApiService;

    private readonly staticConfig: StaticConfigurationService;

    private readonly requestService: RequestService;

    private static readonly MOD_REPO_LIST:ModRepo[] = [
        {
            id: "beatmods",
            mods_repo_url: "https://beatmods.com",
            mods_repo_api_url: "https://beatmods.com/api",
            display_name: "BeatMods",
            website: "https://beatmods.com"
        },
        {
            id: "beatsabercn",
            mods_repo_url: "https://beatmods.bsaber.cn",
            mods_repo_api_url: "https://beatmods.bsaber.cn/api",
            display_name: "CN中文镜像源",
            website: "https://beatmods.bsaber.cn/front/mods"
        }
    ];

    private selectedModRepo: ModRepo = BeatModsApiService.MOD_REPO_LIST.find(repo => repo.default) || BeatModsApiService.MOD_REPO_LIST[0];

    public getSelectedModRepo(): ModRepo {
        return this.selectedModRepo;
    }

    private readonly versionModsCache = new Map<string, BbmFullMod[]>();
    private readonly modsHashCache = new Map<string, BbmModVersion>();

    private resetCache(){
        this.versionModsCache.clear();
        this.modsHashCache.clear();
    }

    public static getInstance(): BeatModsApiService {
        if (!BeatModsApiService.instance) {
            BeatModsApiService.instance = new BeatModsApiService();
        }
        return BeatModsApiService.instance;
    }

    private constructor() {
        this.staticConfig = StaticConfigurationService.getInstance();
        this.requestService = RequestService.getInstance();

        const repoId = this.staticConfig.get("selected-mod-repo");
        if(repoId){
            this.selectedModRepo = BeatModsApiService.MOD_REPO_LIST.find(repo => repo.id === repoId) || BeatModsApiService.MOD_REPO_LIST[0];
        }
    }

    public async isUp(): Promise<boolean> {
        try {
            // The data in status can be dropped
            await this.requestService.getJSON<{}>(`${this.getSelectedModRepo().mods_repo_api_url}/status`);
            return true;
        } catch (error) {
            log.error(`Could not connect to ${this.selectedModRepo.mods_repo_api_url}`, error);
            return false;
        }
    }

    private getVersionModsUrl(version: BSVersion): string {
        const platform: BbmPlatform = version.oculus || version.metadata?.store === BsStore.OCULUS ? BbmPlatform.OculusPC : BbmPlatform.SteamPC;
        return `${this.getSelectedModRepo().mods_repo_api_url}/mods?status=verified&gameVersion=${version.BSVersion}&gameName=BeatSaber&platform=${platform}`;
    }

    public async getModRepoList():Promise<ModRepo[]>{
        return BeatModsApiService.MOD_REPO_LIST;
    }

    public async getSelectedModRepoAsync():Promise<ModRepo>{
        return this.getSelectedModRepo();
    }
    public async selectModRepo(repoId:string): Promise<boolean>{
        const selectedRepo = BeatModsApiService.MOD_REPO_LIST.find(repo => repo.id === repoId);

        if(!selectedRepo){
            return false;
        }

        this.selectedModRepo = selectedRepo;
        this.staticConfig.set("selected-mod-repo", repoId);
        this.resetCache()
        return true;
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

    public async getModByHash(hash: string): Promise<BbmModVersion> {
        if (this.modsHashCache.has(hash)) {
            return Promise.resolve(this.modsHashCache.get(hash));
        }

        return this.requestService.getJSON<{ modVersions: BbmModVersion[] }>(
            `${this.getSelectedModRepo().mods_repo_api_url}/hashlookup?hash=${hash}`
        ).then(({ data }) => {
            this.updateModsHashCache(data?.modVersions ?? []);
            return data?.modVersions?.at(0);
        });
    }
}
