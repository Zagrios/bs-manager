import { LocalBPList } from "shared/models/playlists/local-playlist.models";
import { LocalPlaylistsManagerService } from "../services/additional-content/local-playlists-manager.service";
import { IpcService } from "../services/ipc.service";
import { mergeMap, of } from "rxjs";
import { BPList } from "shared/models/playlists/playlist.interface";
import path from "path";
import { LocalMapsManagerService } from "../services/additional-content/maps/local-maps-manager.service";
import { Progression } from "main/helpers/fs.helpers";
import { lstatSync } from "fs-extra";
import { isValidUrl } from "shared/helpers/url.helpers";
import { pathToFileURL } from "url";

const ipc = IpcService.getInstance();

ipc.on("one-click-install-playlist", (args, reply) => {
    const mapsManager = LocalPlaylistsManagerService.getInstance();
    reply(mapsManager.oneClickInstallPlaylist(args));
});

ipc.on("register-playlists-deep-link", (args, reply) => {
    const maps = LocalPlaylistsManagerService.getInstance();
    reply(of(maps.enableDeepLinks()));
});

ipc.on("unregister-playlists-deep-link", (args, reply) => {
    const maps = LocalPlaylistsManagerService.getInstance();
    reply(of(maps.disableDeepLinks()));
});

ipc.on("is-playlists-deep-links-enabled", (args, reply) => {
    const maps = LocalPlaylistsManagerService.getInstance();
    reply(of(maps.isDeepLinksEnabled()));
});

ipc.on("download-playlist", (args, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();

    const downloadUrl = isValidUrl(args.downloadSource) ? args.downloadSource : pathToFileURL(args.downloadSource).href;

    return reply(playlists.downloadPlaylist({
        bpListUrl: downloadUrl,
        version: args.version,
        ignoreSongsHashs: args.ignoreSongsHashs,
        dest: args.dest
    }));

});

ipc.on("get-version-playlists-details", (args, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();
    reply(playlists.getVersionPlaylistsDetails(args));
});

ipc.on("delete-playlist", (args, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();
    const maps = LocalMapsManagerService.getInstance();
    reply(playlists.deletePlaylistFile(args.bpList).pipe(mergeMap(() => {
        if(args.deleteMaps){
            return maps.deleteMapsFromHashs(args.version, args.bpList.songs.map(s => s.hash));
        }
        return of({ current: 0, total: 0 } as Progression);
    })));
});

ipc.on("export-playlists", (args, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();
    reply(playlists.exportPlaylists(args));
});
