import { Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { IpcService } from "./ipc.service";

export class MapsManagerService {

    private static instance: MapsManagerService;

    public static getInstance(): MapsManagerService{
        if(!MapsManagerService.instance){ MapsManagerService.instance = new MapsManagerService() }
        return MapsManagerService.instance;
    }

    private readonly ipcService: IpcService;

    private constructor(){
        this.ipcService = IpcService.getInstance();
    }

    public getMaps(version?: BSVersion): Observable<BsmLocalMap[]>{
        return new Observable(obs => {
            this.ipcService.send<BsmLocalMap[], BSVersion>("get-version-maps", {args: version}).then(res => {
                if(!res.success){ return obs.next(null);}
                obs.next(res.data);
            });
        });
    }

    public downloadMap(map: any, version?: BSVersion){

    }

    public deleteMaps(maps: any[], version?: BSVersion){

    }



}