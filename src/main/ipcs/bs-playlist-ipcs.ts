import { LocalPlaylistsManagerService } from "../services/additional-content/local-playlists-manager.service";
import { IpcService } from "../services/ipc.service";
import { of } from "rxjs";

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

ipc.on("install-playlist", (args, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();

    if(args.playlist?.customData?.syncURL){
        return reply(playlists.downloadPlaylist(args.playlist.customData.syncURL, args.version));
    }

    reply(playlists.downloadPlaylistSongs(args.playlist.songs, args.version));

});

ipc.on("get-version-playlists-details", (args, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();
    reply(playlists.getVersionPlaylistsDetails(args));
});

ipc.on("delete-playlist", (args, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();
    reply(playlists.deletePlaylist(args));
});
