import { createLocalMapsManagerServiceV2 } from "./local-maps-manager-v2.service";
import { BSLocalVersionService } from "main/services/bs-local-version.service";
import { InstallationLocationService } from "main/services/installation-location.service";
import { SongCacheService } from "./song-cache.service";
import { SongDetailsCacheService } from "./song-details-cache.service";

const localVersionService = BSLocalVersionService.getInstance();
const installLocationService = InstallationLocationService.getInstance();
const songCacheService = SongCacheService.getInstance();
const songDetailsCacheService = SongDetailsCacheService.getInstance();

const localMapsManagerServiceV2 = createLocalMapsManagerServiceV2({
    localVersionService: {
        getVersionPath: async (version) => localVersionService.getVersionPath(version),
    },
    installLocationService: {
        sharedContentPath: () => installLocationService.sharedContentPath(),
    },
    songCacheService: {
        getMapInfoFromDirname: (dirname) => songCacheService.getMapInfoFromDirname(dirname),
    },
    songDetailsCacheService: {
        getSongDetails: (hash) => songDetailsCacheService.getSongDetails(hash),
    },
});

export default localMapsManagerServiceV2;
