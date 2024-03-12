import { BSVersion } from "shared/bs-version.interface";
import { LocalPlaylistsManagerService } from "../services/additional-content/local-playlists-manager.service";
import { IpcService } from "../services/ipc.service";
import { of, throwError } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on<string>("one-click-install-playlist", (req, reply) => {
    const playlists = LocalPlaylistsManagerService.getInstance();
    reply(playlists.oneClickInstallPlaylist(req.args));
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
