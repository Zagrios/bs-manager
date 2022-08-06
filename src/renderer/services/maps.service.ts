import { BSVersion } from "shared/bs-version.interface";
import { OpenSaveDialogOption } from "shared/models/ipc";
import { ExportVersionMapsOption } from "shared/models/maps/export-version-maps.model";
import { IpcService } from "./ipc.service";
import { NotificationService } from "./notification.service";
import { ProgressBarService } from "./progress-bar.service";

export class MapService {

    private static instance: MapService;

    private readonly ipcService: IpcService;
    private readonly progressService: ProgressBarService;
    private readonly notificationService: NotificationService;

    public static getInstance(): MapService{
        if(!MapService.instance){ MapService.instance = new MapService(); }
        return MapService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.progressService = ProgressBarService.getInstance();
    }

    public async exportVersionMaps(version: BSVersion): Promise<void>{
        if(!this.progressService.require()){ return; }

        const resFile = await this.ipcService.send<string, OpenSaveDialogOption>("save-file", {args: {
            filename: `${version.BSVersion} Maps`,
            filters: [{name: "zip", extensions: ["zip"]}]
        }});

        if(!resFile.success){ return; }

        this.progressService.showFake(.008);
        
        const resExport = await this.ipcService.send<string, ExportVersionMapsOption>("map.export-version", {args: {version, path: resFile.data}});
        if(!resExport.success && resExport.error.title){
            const {title, msg} = resExport.error;
            this.notificationService.notifyError({title, desc: msg});
        } 
        else {
            this.notificationService.notifySuccess({title: "Export terminé 🎉", duration: 3000});
        }
        this.progressService.complete();
        this.progressService.hide(true);
    }

}