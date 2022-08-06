import { ipcMain} from 'electron';
import { MapService } from '../services/map.service';
import { UtilsService } from '../services/utils.service';
import { IpcRequest } from 'shared/models/ipc';
import { ExportVersionMapsOption } from 'shared/models/maps/export-version-maps.model';

ipcMain.on("map.export-version", (event, request: IpcRequest<ExportVersionMapsOption>) => {
    const utils = UtilsService.getInstance();
    const mapService = MapService.getInstance();
    mapService.exportVersionMaps(request.args.version, request.args.path).then(() => {
        utils.ipcSend(request.responceChannel, {success: true});
    }).catch(() => utils.ipcSend(request.responceChannel, {success: false, error: {title: "", msg: ""}}));
});