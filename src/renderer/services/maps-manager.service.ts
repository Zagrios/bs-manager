import { LinkMapsModal } from "renderer/components/modal/modal-types/link-maps-modal.component";
import { UnlinkMapsModal } from "renderer/components/modal/modal-types/unlink-maps-modal.component";
import { finalize } from "rxjs/operators";
import { Subject, Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { BeatSaverService } from "./beat-saver/beat-saver.service";
import { IpcService } from "./ipc.service";
import { ModalExitCode, ModalService } from "./modale.service";
import { DeleteMapsModal } from "renderer/components/modal/modal-types/delete-maps-modal.component";
import { ProgressBarService } from "./progress-bar.service";

export class MapsManagerService {

    private static instance: MapsManagerService;

    public static getInstance(): MapsManagerService{
        if(!MapsManagerService.instance){ MapsManagerService.instance = new MapsManagerService() }
        return MapsManagerService.instance;
    }

    private readonly ipcService: IpcService;
    private readonly bsaver: BeatSaverService;
    private readonly modal: ModalService;
    private readonly progressBar: ProgressBarService;

    private readonly lastLinkedVersion$: Subject<BSVersion> = new Subject();
    private readonly lastUnlinkedVersion$: Subject<BSVersion> = new Subject();

    private constructor(){
        this.ipcService = IpcService.getInstance();
        this.bsaver = BeatSaverService.getInstance();
        this.modal = ModalService.getInsance();
        this.progressBar = ProgressBarService.getInstance();
    }

    public getMaps(version?: BSVersion, withDetails = true): Observable<BsmLocalMap[]>{
        return new Observable(obs => {
            this.ipcService.send<BsmLocalMap[], BSVersion>("get-version-maps", {args: version}).then(res => {
                if(!res.success){ return obs.next(null);}
                obs.next(res.data);

                if(!withDetails){ return obs.complete(); }

                console.log("GET DETAILS");

                this.bsaver.getMapDetailsFromHashs(res.data.map(localMap => localMap.hash)).pipe(finalize(() => obs.complete())).subscribe(mapsDetails => {
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

    public async linkVersion(version: BSVersion): Promise<void>{

        const modalRes = await this.modal.openModal(LinkMapsModal);

        if(modalRes.exitCode !== ModalExitCode.COMPLETED){ return; }

        const showProgressBar = this.progressBar.require();

        if(showProgressBar){
            this.progressBar.showFake(.01);
        }

        const res = await this.ipcService.send<void, {version: BSVersion, keepMaps: boolean}>("link-version-maps", {args: {version, keepMaps: !!modalRes.data}});

        if(showProgressBar){
            this.progressBar.hide(true);
        }

        if(res.success){
            this.lastLinkedVersion$.next(version);
        }
    }

    public async unlinkVersion(version: BSVersion): Promise<void>{

        const modalRes = await this.modal.openModal(UnlinkMapsModal);

        if(modalRes.exitCode !== ModalExitCode.COMPLETED){ return; }

        const showProgressBar = this.progressBar.require();

        if(showProgressBar){
            this.progressBar.showFake(.01);
        }

        const res = await this.ipcService.send<void, {version: BSVersion, keepMaps: boolean}>("unlink-version-maps", {args: {version, keepMaps: !!modalRes.data}});

        if(showProgressBar){
            this.progressBar.hide(true);
        }

        if(res.success){
            this.lastUnlinkedVersion$.next(version);
        }
    }

    public async deleteMaps(maps: BsmLocalMap[], version?: BSVersion): Promise<boolean>{

        const versionLinked = await this.versionHaveMapsLinked(version);

        const modalRes = await this.modal.openModal(DeleteMapsModal, {linked: versionLinked, maps});

        if(modalRes.exitCode !== ModalExitCode.COMPLETED){ return false; }

        const showProgressBar = this.progressBar.require(); 

        if(showProgressBar && maps.length > 1){
            this.progressBar.showFake(.008);
        }

        const res = await this.ipcService.send<void, {version: BSVersion, maps: BsmLocalMap[]}>("delete-maps", {args: {version, maps}});

        if(showProgressBar && maps.length > 1){
            this.progressBar.hide(true);
        }

        return res.success;
    }

    public get versionLinked$(): Observable<BSVersion>{
        return this.lastLinkedVersion$.asObservable();
    }

    public get versionUnlinked$(): Observable<BSVersion>{
        return this.lastUnlinkedVersion$.asObservable();
    }

}