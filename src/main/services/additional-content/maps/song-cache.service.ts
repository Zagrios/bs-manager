import { CACHE_PATH } from "main/constants";
import { JsonCache } from "main/models/json-cache.class";
import path from "path";
import { RawMapInfoData } from "shared/models/maps";

export class SongCacheService {

    private static instance: SongCacheService;

    public static getInstance(): SongCacheService {
        if (!SongCacheService.instance) {
            SongCacheService.instance = new SongCacheService();
        }
        return SongCacheService.instance;
    }

    private readonly RAW_INFOS_CACHE_PATH = path.join(CACHE_PATH, "song-raw-info-cache.json");

    private readonly rawInfosCache: JsonCache<CachedRawInfoWithHash>;

    private constructor(){
        this.rawInfosCache = new JsonCache(this.RAW_INFOS_CACHE_PATH);
    }

    public getMapInfoFromDirname(dirname: string): CachedRawInfoWithHash {
        return this.rawInfosCache.get(dirname);
    }

    public setMapInfoFromDirname(dirname: string, info: CachedRawInfoWithHash): void {
        this.rawInfosCache.set(dirname, info);
    }

    public deleteMapInfoFromDirname(dirname: string): void {
        this.rawInfosCache.delete(dirname);
    }

}

export type CachedRawInfoWithHash = {
    hash: string;
    rawInfo: RawMapInfoData;
};
