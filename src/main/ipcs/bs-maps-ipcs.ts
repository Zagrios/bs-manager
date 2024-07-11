import { LocalMapsManagerService } from "../services/additional-content/maps/local-maps-manager.service";
import { IpcService } from "../services/ipc.service";
import { from, of, throwError } from "rxjs";
import { tryit } from "shared/helpers/error.helpers";
import { SongDetailsCacheService } from "main/services/additional-content/maps/song-details-cache.service";
import { SongDetails } from "shared/models/maps";

const ipc = IpcService.getInstance();

ipc.on("load-version-maps", (args, reply) => {
    const localMaps = LocalMapsManagerService.getInstance();
    reply(localMaps.getMaps(args));
});

ipc.on("delete-maps", (args, reply) => {
    const maps = LocalMapsManagerService.getInstance();
    reply(maps.deleteMaps(args));
});

ipc.on("export-maps", async (args, reply) => {
    const maps = LocalMapsManagerService.getInstance();
    reply(await maps.exportMaps(args.version, args.maps, args.outPath));
});

ipc.on("download-map", async (args, reply) => {
    const maps = LocalMapsManagerService.getInstance();
    reply(from(maps.downloadMap(args.map, args.version)));
});

ipc.on("one-click-install-map", (args, reply) => {
    const maps = LocalMapsManagerService.getInstance();
    reply(from(maps.oneClickDownloadMap(args)))
});

ipc.on("register-maps-deep-link", (_, reply) => {
    const maps = LocalMapsManagerService.getInstance();
    const { error, result } = tryit(() => maps.enableDeepLinks());

    if(error) {
        return reply(throwError(() => error));
    }

    reply(of(result));
});

ipc.on("unregister-maps-deep-link", (_, reply) => {
    const maps = LocalMapsManagerService.getInstance();
    const { error, result } = tryit(() => maps.disableDeepLinks());

    if(error) {
        return reply(throwError(() => error));
    }

    reply(of(result));
});

ipc.on("is-map-deep-links-enabled", (_, reply) => {
    const maps = LocalMapsManagerService.getInstance();
    const { error, result } = tryit(() => maps.isDeepLinksEnabled());

    if(error) {
        return reply(throwError(() => error));
    }

    reply(of(result));
});

ipc.on("get-maps-info-from-cache", (args, reply) => {
    const songsCache = SongDetailsCacheService.getInstance();

    const res = (args ?? []).reduce((acc, hash) => {
        const songDetails = songsCache.getSongDetails(hash);

        if(songDetails){
            acc.push(songDetails);
        }

        return acc;
    }, [] as SongDetails[]);

    reply(of(res));

})
