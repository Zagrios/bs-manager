import { Subject, Observable } from "rxjs";
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

    private readonly lastLinkedVersion$: Subject<BSVersion> = new Subject();
    private readonly lastUnlinkedVersion$: Subject<BSVersion> = new Subject();

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

    public linkVersion(version: BSVersion): Promise<void>{
        return this.ipcService.send<void, {version: BSVersion, keepMaps: boolean}>("link-version-maps", {args: {version, keepMaps: true}}).then(res => {
            if(res.success){
                return this.lastLinkedVersion$.next(version);
            }
            throw res.error;
        });
    }

    public unlinkVersion(version: BSVersion): Promise<void>{
        return this.ipcService.send<void, {version: BSVersion, keepMaps: boolean}>("unlink-version-maps", {args: {version, keepMaps: true}}).then(res => {
            if(res.success){
                return this.lastUnlinkedVersion$.next(version);
            }
            throw res.error;
        });
    }

    public get versionLinked$(): Observable<BSVersion>{
        return this.lastLinkedVersion$.asObservable();
    }

    public get versionUnlinked$(): Observable<BSVersion>{
        return this.lastUnlinkedVersion$.asObservable();
    }

}