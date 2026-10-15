import { BsStore } from "shared/models/bs-store.enum";
import { ConfigurationService } from "../configuration.service";
import { BSVersion } from "shared/bs-version.interface";
import { ModalExitCode, ModalService } from "../modale.service";
import { ChooseStore } from "renderer/components/modal/modal-types/bs-downgrade/choose-store-modal.component";
import { BSVersionOutdatedModal } from "renderer/components/modal/modal-types/bs-version-outdated-modal.component";
import { SteamDownloaderService } from "./steam-downloader.service";
import { OculusDownloaderService } from "./oculus-downloader.service";
import { DownloaderServiceInterface } from "./bs-store-downloader.interface";
import { BSVersionManagerService } from "../bs-version-manager.service";
import { BehaviorSubject, Observable } from "rxjs";
import { safeLt } from "shared/helpers/semver.helpers";

export class BsDownloaderService {

    private static instance: BsDownloaderService;

    public static getInstance(): BsDownloaderService {
        if (!BsDownloaderService.instance) {
            BsDownloaderService.instance = new BsDownloaderService();
        }

        return BsDownloaderService.instance;
    }

    private readonly config: ConfigurationService;
    private readonly modals: ModalService;
    private readonly steamDownloader: SteamDownloaderService;
    private readonly oculusDownloader: OculusDownloaderService;
    private readonly versionManager: BSVersionManagerService;

    private readonly SELECTED_STORE_TO_DOWNLOAD_KEY = "selectedStoreToDownload";

    private readonly _busy$ = new BehaviorSubject<boolean>(false);
    private readonly _downloadingVersion$ = new BehaviorSubject<BSVersion>(null);
    private readonly _isVerifying$ = new BehaviorSubject<boolean>(false);

    private constructor(){
        this.config = ConfigurationService.getInstance();
        this.modals = ModalService.getInstance();
        this.steamDownloader = SteamDownloaderService.getInstance();
        this.oculusDownloader = OculusDownloaderService.getInstance();
        this.versionManager = BSVersionManagerService.getInstance();
    }

    public get busy$(): Observable<boolean>{ return this._busy$.asObservable(); }
    public get busy(): boolean{ return this._busy$.getValue(); }

    public get downloadingVersion$(): Observable<BSVersion>{ return this._downloadingVersion$.asObservable(); }
    public get downloadingVersion(): BSVersion{ return this._downloadingVersion$.getValue(); }

    public get isVerifying$(): Observable<boolean>{ return this._isVerifying$.asObservable(); }
    public get isVerifying(): boolean{ return this._isVerifying$.getValue(); }

    private getStoreDownloader(bsStore: BsStore): DownloaderServiceInterface{
        switch(bsStore){
            case BsStore.OCULUS:
                return this.oculusDownloader;
            case BsStore.STEAM:
                return this.steamDownloader;
            default:
                throw new Error("Unknown store");
        }
    }

    private async exclusive<T>(task: () => Promise<T>): Promise<T | undefined> {
        if(this.busy){
            return undefined;
        }

        this._busy$.next(true);

        try {
            return await task();
        } finally {
            this._downloadingVersion$.next(null);
            this._isVerifying$.next(false);
            this._busy$.next(false);
        }
    }

    private runStoreDownload(store: BsStore, version: BSVersion, isVerification: boolean): Promise<BSVersion | undefined> {
        return this.getStoreDownloader(store).download(version, {
            isVerification,
            onStart: downloadingVersion => this._downloadingVersion$.next(downloadingVersion),
        }).finally(() => this.versionManager.askInstalledVersions());
    }

    private async confirmOutdatedVersion(version: BSVersion): Promise<boolean> {
        if(this.config.get("not-show-bs-version-outdated-modal")){
            return true;
        }

        const recommendedVersion = this.versionManager.getRecommendedVersion();

        if(!safeLt(version.BSVersion, recommendedVersion?.BSVersion)){
            return true;
        }

        const res = await this.modals.openModal(BSVersionOutdatedModal, {data: { outdated: version, recommended: recommendedVersion }});
        return res.exitCode === ModalExitCode.COMPLETED;
    }

    public get defaultStore(): BsStore | undefined { return this.config.get<BsStore>(this.SELECTED_STORE_TO_DOWNLOAD_KEY); }
    public get defaultStore$(): Observable<BsStore | undefined> { return this.config.watch(this.SELECTED_STORE_TO_DOWNLOAD_KEY); }

    public setDefaultStore(store: BsStore|undefined): void {
        this.config.set(this.SELECTED_STORE_TO_DOWNLOAD_KEY, store);
    }

    public async chooseStoreToDownloadFrom(): Promise<BsStore | undefined> {
        const res = await this.modals.openModal(ChooseStore);

        if(res.exitCode !== ModalExitCode.COMPLETED){
            return undefined;
        }

        return res.data;
    }

    public downloadVersion(version: BSVersion, from?: BsStore): Promise<BSVersion | undefined> {
        return this.exclusive(async () => {
            if(!(await this.confirmOutdatedVersion(version))){
                return undefined;
            }

            const store = from ?? this.defaultStore ?? await this.chooseStoreToDownloadFrom();

            if(!store){
                return undefined;
            }

            return this.runStoreDownload(store, version, false);
        });
    }

    public verifyBsVersion(version: BSVersion): Promise<BSVersion | undefined> {
        return this.exclusive(() => {
            this._isVerifying$.next(true);

            const store = (() => {
                if(version.metadata?.store){ return version.metadata.store; }
                return version.steam ? BsStore.STEAM : BsStore.OCULUS;
            })();

            return this.runStoreDownload(store, version, true);
        });
    }

    public async stopDownload(): Promise<void> {
        return Promise.all([
            this.steamDownloader.stopDownload(),
            this.oculusDownloader.stopDownload()
        ]).then(() => {});
    }

}
