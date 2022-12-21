import { ipcMain } from "electron";
import { IpcRequest } from "shared/models/ipc";
import { LocalPlaylistsManagerService } from "../services/additional-content/local-playlists-manager.service";
import { UtilsService } from "../services/utils.service";

ipcMain.on("one-click-install-playlist", async (event, request: IpcRequest<string>) => {

    console.log("OUI");

    const utils = UtilsService.getInstance();
    const playlists = LocalPlaylistsManagerService.getInstance();

    console.log(request.args);

    playlists.oneClickInstallPlaylist(request.args).then(() => {
        console.log("C FINI");
        utils.ipcSend(request.responceChannel, {success: true});
    }).catch(e => {
        console.log(e);
        utils.ipcSend(request.responceChannel, {success: false, error: e});
    });
});