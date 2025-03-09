import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { Observable } from "rxjs";
import { Progression } from "main/helpers/fs.helpers";
import { BSLocalVersionServiceV2, InstallationLocationServiceV2 } from "main/services/types";
import { CachedMapInfoWithHash } from "./song-cache.service";
import { SongDetails } from "shared/models/maps";

// NOTE: Partial interfaces for now

export interface LocalMapsManagerServiceV2Params {
    localVersionService: BSLocalVersionServiceV2;
    installLocationService: InstallationLocationServiceV2;
    songCacheService: SongCacheServiceV2;
    songDetailsCacheService: SongDetailsCacheServiceV2;
}

export interface LocalMapsManagerServiceV2 {
    getMapsFolderPath(version?: BSVersion): Promise<string>;
    importMaps(zipPaths: string[], version?: BSVersion): Observable<Progression<BsmLocalMap>>;
}

export interface SongCacheServiceV2 {
    getMapInfoFromDirname(dirname: string): CachedMapInfoWithHash;
}

export interface SongDetailsCacheServiceV2 {
    getSongDetails(hash: string): SongDetails | undefined;
}
