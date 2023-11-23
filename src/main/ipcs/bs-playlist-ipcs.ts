import { ipcMain } from "electron";
import { IpcRequest } from "shared/models/ipc";
import { LocalPlaylistsManagerService } from "../services/additional-content/local-playlists-manager.service";
import { UtilsService } from "../services/utils.service";
import { IpcService } from "../services/ipc.service";

const ipc = IpcService.getInstance();

ipc.on<string>("one-click-install-playlist", (req, reply) => {
    const mapsManager = LocalPlaylistsManagerService.getInstance();
    reply(mapsManager.oneClickInstallPlaylist(req.args));
});

ipcMain.on("register-playlists-deep-link", async (event, request: IpcRequest<void>) => {
    const maps = LocalPlaylistsManagerService.getInstance();
    const utils = UtilsService.getInstance();

    try {
        const res = maps.enableDeepLinks();
        utils.ipcSend(request.responceChannel, { success: true, data: res });
    } catch (e) {
        utils.ipcSend(request.responceChannel, { success: false });
    }
});

ipcMain.on("unregister-playlists-deep-link", async (event, request: IpcRequest<void>) => {
    const maps = LocalPlaylistsManagerService.getInstance();
    const utils = UtilsService.getInstance();

    try {
        const res = maps.disableDeepLinks();
        utils.ipcSend(request.responceChannel, { success: true, data: res });
    } catch (e) {
        utils.ipcSend(request.responceChannel, { success: false });
    }
});

ipcMain.on("is-playlists-deep-links-enabled", async (event, request: IpcRequest<void>) => {
    const maps = LocalPlaylistsManagerService.getInstance();
    const utils = UtilsService.getInstance();

    try {
        const res = maps.isDeepLinksEnabled();
        utils.ipcSend(request.responceChannel, { success: true, data: res });
    } catch (e) {
        utils.ipcSend(request.responceChannel, { success: false });
    }
});
