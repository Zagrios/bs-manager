import { ipcMain } from "electron";
import { UtilsService } from "../services/utils.service";
import { IpcRequest } from "shared/models/ipc";
import { SearchParams } from "shared/models/maps/beat-saver.model";
import { BeatSaverService } from "../services/thrid-party/beat-saver/beat-saver.service";

ipcMain.on("bsv-search-map", async (event, request: IpcRequest<SearchParams>) => {
    const utlis = UtilsService.getInstance();
    const bsvService = BeatSaverService.getInstance();

    bsvService.searchMaps(request.args).then(maps => {
        utlis.ipcSend(request.responceChannel, {success: true, data: maps});
    }).catch(e => {
        utlis.ipcSend(request.responceChannel, {success: false, error: e});
    })
});

ipcMain.on("bsv-get-map-details-from-hashs", async (event, request: IpcRequest<string[]>) => {
    const utlis = UtilsService.getInstance();
    const bsvService = BeatSaverService.getInstance();

    bsvService.getMapDetailsFromHashs(request.args).then(maps => {
        utlis.ipcSend(request.responceChannel, {success: true, data: maps});
    }).catch(e => {
        utlis.ipcSend(request.responceChannel, {success: false, error: e});
    })
});

ipcMain.on("bsv-get-map-details-by-id", async (event, request: IpcRequest<string>) => {
    const utlis = UtilsService.getInstance();
    const bsvService = BeatSaverService.getInstance();

    bsvService.getMapDetailsById(request.args).then(maps => {
        utlis.ipcSend(request.responceChannel, {success: true, data: maps});
    }).catch(e => {
        utlis.ipcSend(request.responceChannel, {success: false, error: e});
    })
});

ipcMain.on("bsv-get-playlist-details-by-id", async (event, request: IpcRequest<string>) => {
    const utlis = UtilsService.getInstance();
    const bsvService = BeatSaverService.getInstance();

    bsvService.getPlaylistPage(request.args).then(maps => {
        utlis.ipcSend(request.responceChannel, {success: true, data: maps});
    }).catch(e => {
        utlis.ipcSend(request.responceChannel, {success: false, error: e});
    })
});