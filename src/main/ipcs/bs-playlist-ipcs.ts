import { LocalPlaylistsManagerService } from "../services/additional-content/local-playlists-manager.service";
import { IpcService } from "../services/ipc.service";
import { of, throwError } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on<string>("one-click-install-playlist", (req, reply) => {
    const mapsManager = LocalPlaylistsManagerService.getInstance();
    reply(mapsManager.oneClickInstallPlaylist(req.args));
});

ipc.on("register-playlists-deep-link", (_, reply) => {
    const maps = LocalPlaylistsManagerService.getInstance();

    try {
        reply(of(maps.enableDeepLinks()));
    } catch (e) {
        reply(throwError(() => e));
    }
});

ipc.on("unregister-playlists-deep-link", (_, reply) => {
    const maps = LocalPlaylistsManagerService.getInstance();

    try {
        reply(of(maps.disableDeepLinks()));
    } catch (e) {
        reply(throwError(() => e));
    }
});

ipc.on("is-playlists-deep-links-enabled", (_, reply) => {
    const maps = LocalPlaylistsManagerService.getInstance();

    try {
        reply(of(maps.isDeepLinksEnabled()));
    } catch (e) {
        reply(throwError(() => e));
    }
});
