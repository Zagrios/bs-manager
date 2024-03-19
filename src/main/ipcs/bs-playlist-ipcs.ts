import { BSVersion } from "shared/bs-version.interface";
import { LocalPlaylistsManagerService } from "../services/additional-content/local-playlists-manager.service";
import { IpcService } from "../services/ipc.service";
import { of, throwError } from "rxjs";
import { BPList } from "shared/models/playlists/playlist.interface";

const ipc = IpcService.getInstance();

ipc.on<string>("one-click-install-playlist", (req, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();
    reply(playlists.oneClickInstallPlaylist(req.args));
});

ipc.on<{playlist: BPList, version: BSVersion}>("install-playlist", (req, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();

    if(req.args.playlist?.customData?.syncURL){
        return reply(playlists.downloadPlaylist(req.args.playlist.customData.syncURL, req.args.version));
    }

    reply(playlists.downloadPlaylistSongs(req.args.playlist.songs, req.args.version));

});

ipc.on("register-playlists-deep-link", (_, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();

    try {
        reply(of(playlists.enableDeepLinks()));
    } catch (e) {
        reply(throwError(() => e));
    }
});

ipc.on("unregister-playlists-deep-link", (_, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();

    try {
        reply(of(playlists.disableDeepLinks()));
    } catch (e) {
        reply(throwError(() => e));
    }
});

ipc.on("is-playlists-deep-links-enabled", (_, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();

    try {
        reply(of(playlists.isDeepLinksEnabled()));
    } catch (e) {
        reply(throwError(() => e));
    }
});

ipc.on<BSVersion>("get-version-playlists-details", (req, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();
    reply(playlists.getVersionPlaylistsDetails(req.args));
});

ipc.on<{path: string, deleteMaps?: boolean}>("delete-playlist", (req, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();
    reply(playlists.deletePlaylist(req.args));
});
