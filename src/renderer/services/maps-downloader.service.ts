import { DownloadMapsModal } from "renderer/components/modal/modal-types/download-maps-modal.component";
import { map, filter, share } from "rxjs/operators";
import { BehaviorSubject, timer, Observable, lastValueFrom } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { ModalResponse, ModalService } from "./modale.service";
import { ProgressBarService } from "./progress-bar.service";
import { ProgressionInterface } from "shared/models/progress-bar";
import { BsvMapDetail } from "shared/models/maps";
import { IpcService } from "./ipc.service";
import { OsDiagnosticService } from "./os-diagnostic.service";
import equal from "fast-deep-equal/es6";
import { CSSProperties } from "react";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";

export class MapsDownloaderService {
    private static instance: MapsDownloaderService;

    public static getInstance(): MapsDownloaderService {
        if (!MapsDownloaderService.instance) {
            MapsDownloaderService.instance = new MapsDownloaderService();
        }
        return MapsDownloaderService.instance;
    }

    private readonly modals: ModalService;
    private readonly progressBar: ProgressBarService;
    private readonly ipc: IpcService;
    private readonly os: OsDiagnosticService;

    private readonly mapsQueue$: BehaviorSubject<MapDownload[]> = new BehaviorSubject([]);
    private readonly currentDownload$: BehaviorSubject<MapDownload> = new BehaviorSubject(null);
    private queueMaxLenght = 0;
    public readonly progressBarStyle: CSSProperties = { zIndex: 100000, position: "fixed", bottom: "10px", right: 0 };

    private _lastDownloadedMap$: Observable<{map: BsmLocalMap, version?: BSVersion}>;

    private constructor() {
        this.modals = ModalService.getInstance();
        this.progressBar = ProgressBarService.getInstance();
        this.ipc = IpcService.getInstance();
        this.os = OsDiagnosticService.getInstance();

        this.mapsQueue$.pipe(filter(queue => queue.length === 1 && !this.isDownloading)).subscribe(() => this.startDownloadMaps());
        this.mapsQueue$.pipe(filter(queue => queue.length === 0)).subscribe(() => {
            this.queueMaxLenght = 0;
        });
    }

    private async startDownloadMaps() {
        this.progressBar.show(this.downloadProgress$, this.progressBarStyle);

        await timer(2000).toPromise();

        while (this.mapsQueue$.value.at(0)) {
            const toDownload = this.mapsQueue$.value.at(0);
            this.currentDownload$.next(toDownload);
            await lastValueFrom(this.downloadMap(toDownload.map, toDownload.version));

            const newArr = [...this.mapsQueue$.value];
            newArr.shift();
            this.mapsQueue$.next(newArr);
        }

        await timer(500).toPromise();

        this.currentDownload$.next(null);
        this.progressBar.hide();
    }

    private downloadMap(map: BsvMapDetail, version: BSVersion): Observable<BsmLocalMap> {
        if (this.os.isOffline) {
            return null;
        }
        return this.ipc.sendV2("download-map", { map, version });
    }

    public async openDownloadMapModal(version?: BSVersion, ownedMaps: BsmLocalMap[] = []): Promise<ModalResponse<void>> {
        const res = await this.modals.openModal(DownloadMapsModal, {data: { version, ownedMaps }});
        this.progressBar.setStyle(null);
        return res;
    }

    public addMapToDownload(downloadMap: MapDownload) {
        if (this.mapsQueue$.value.length === 0 && !this.progressBar.require()) {
            return;
        }
        this.queueMaxLenght++;
        this.mapsQueue$.next([...this.mapsQueue$.value, downloadMap]);
    }

    public removeMapToDownload(downloadMap: MapDownload) {
        const newArr = [...this.mapsQueue$.value];
        const index = newArr.findIndex(toDownload => toDownload.map.id === downloadMap.map.id && equal(toDownload.version, downloadMap.version));
        if (index < 0) {
            return;
        }
        newArr.splice(index, 1);
        this.mapsQueue$.next(newArr);
    }

    public get downloadProgress$(): Observable<ProgressionInterface> {
        return this.mapsQueue$.pipe(
            map<MapDownload[], ProgressionInterface>(download => {
                let progress = this.queueMaxLenght === 0 ? 100 : (100 / this.queueMaxLenght) * (this.queueMaxLenght - download.length) + 0.1;
                progress = progress > 100 ? 100 : progress;
                return { progression: progress, label: download.at(0)?.map.name || "" };
            })
        );
    }

    public get currentMapDownload$(): Observable<MapDownload> {
        return this.currentDownload$.asObservable();
    }

    public get mapsInQueue$(): Observable<MapDownload[]> {
        return this.mapsQueue$.asObservable();
    }

    public get lastDownloadedMap$(): Observable<{map: BsmLocalMap, version?: BSVersion}> {
        if(!this._lastDownloadedMap$){
            this._lastDownloadedMap$ = new Observable<{map: BsmLocalMap, version?: BSVersion}>(observer => {
                const sub = this.ipc.sendV2("last-downloaded-map").subscribe(observer);

                return () => {
                    this._lastDownloadedMap$ = null;
                    sub.unsubscribe();
                }
            }).pipe(share());
        }

        return this._lastDownloadedMap$;
    }

    public async oneClickInstallMap(map: BsvMapDetail): Promise<void> {
        this.progressBar.showFake(0.04);
        return lastValueFrom(this.ipc.sendV2("one-click-install-map", map));
    }

    public get isDownloading(): boolean {
        return !!this.currentDownload$.value;
    }
}

export interface MapDownload {
    map: BsvMapDetail;
    version: BSVersion;
}

export type MapsDownloadedListener = (map: BsmLocalMap, version: BSVersion) => void;
