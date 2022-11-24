import { Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { BeatSaverService } from "./beat-saver/beat-saver.service";
import { IpcService } from "./ipc.service";

export class MapsManagerService {

    private static instance: MapsManagerService;

    public static getInstance(): MapsManagerService{
        if(!MapsManagerService.instance){ MapsManagerService.instance = new MapsManagerService() }
        return MapsManagerService.instance;
    }

    private readonly ipcService: IpcService;
    private readonly bsaver: BeatSaverService;

    private constructor(){
        this.ipcService = IpcService.getInstance();
        this.bsaver = BeatSaverService.getInstance();
    }

    public getMaps(version?: BSVersion): Observable<BsmLocalMap[]>{
        return new Observable(obs => {
            this.ipcService.send<BsmLocalMap[], BSVersion>("get-version-maps", {args: version}).then(res => {
                if(!res.success){ return obs.next(null);}
                obs.next(res.data);

                this.bsaver.getMapDetailsFromHashs(res.data.map(localMap => localMap.hash)).subscribe(mapsDetails => {
                    mapsDetails.forEach(details => {
                        res.data.find(localMap => localMap.hash === details.versions.find(details => details?.hash === localMap.hash)?.hash).bsaverInfo = details
                    });
                    obs.next(res.data);
                })
            });
        });
    }

    public versionHaveMapsLinked(version: BSVersion): Promise<boolean>{
        return this.ipcService.send<boolean, BSVersion>("verion-have-maps-linked", {args: version}).then(res => {
            if(!res.success){ throw "error"; }
            return res.data;
        })
    }

    public downloadMap(map: any, version?: BSVersion){

    }

    public deleteMaps(maps: any[], version?: BSVersion){

    }



}