import { CACHE_PATH } from "main/constants";
import { JsonCache } from "main/models/json-cache.class";
import path from "path";
import { MapInfo } from "shared/models/maps/info/map-info.model";

export class SongCacheService {

    private static instance: SongCacheService;

    public static getInstance(): SongCacheService {
        if (!SongCacheService.instance) {
            SongCacheService.instance = new SongCacheService();
        }
        return SongCacheService.instance;
    }

    private readonly MAPS_INFO_CACHE_PATH = path.join(CACHE_PATH, "map-info-cache.json");

    private readonly mapsInfoCache: JsonCache<CachedMapInfoWithHash>;

    private constructor(){
        console.log(this.MAPS_INFO_CACHE_PATH);
        this.mapsInfoCache = new JsonCache(this.MAPS_INFO_CACHE_PATH);
    }

    public getMapInfoFromDirname(dirname: string): CachedMapInfoWithHash {
        return this.mapsInfoCache.get(dirname);
    }

    public getMapInfoFromHash(hash: string): { dirname: string, info: CachedMapInfoWithHash } | undefined {
        const res = Object.entries(this.mapsInfoCache.cache).find(([, info]) => info.hash === hash);
        return res ? { dirname: res[0], info: res[1] } : undefined;
    }

    public setMapInfoFromDirname(dirname: string, info: CachedMapInfoWithHash): void {
        this.mapsInfoCache.set(dirname, info);
    }

    public deleteMapInfoFromDirname(dirname: string): void {
        this.mapsInfoCache.delete(dirname);
    }

}

export type CachedMapInfoWithHash = {
    hash: string;
    mapInfo: MapInfo;
};
