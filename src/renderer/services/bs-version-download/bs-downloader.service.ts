import { BsStore } from "shared/models/bs-store.enum";
import { ConfigurationService } from "../configuration.service";
import { BSVersion } from "shared/bs-version.interface";
import { ModalExitCode, ModalService } from "../modale.service";
import { ChooseStore } from "renderer/components/modal/modal-types/bs-downgrade/choose-store-modal.component";
import { SteamDownloaderService } from "./steam-downloader.service";
import { OculusDownloaderService } from "./oculus-downloader.service";
import { DownloaderServiceInterface } from "./bs-store-downloader.interface";
import { AbstractBsDownloaderService } from "./abstract-bs-downloader.service";
import { BSVersionManagerService } from "../bs-version-manager.service";

export class BsDownloaderService extends AbstractBsDownloaderService {

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

    private constructor(){
        super();
        this.config = ConfigurationService.getInstance();
        this.modals = ModalService.getInstance();
        this.steamDownloader = SteamDownloaderService.getInstance();
        this.oculusDownloader = OculusDownloaderService.getInstance();
        this.versionManager = BSVersionManagerService.getInstance();
    }

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

    private resetDownloadState(){
        this._downloadingVersion$.next(null);
        this._isVerifying$.next(false);
    }

    public getLastStoreDownloadedFrom(): BsStore | undefined {
        return this.config.get<BsStore>("lastStoreDownloadedFrom");
    }

    public async chooseStoreToDownloadFrom(): Promise<BsStore | undefined> {
        const res = await this.modals.openModal(ChooseStore);

        if(res.exitCode !== ModalExitCode.COMPLETED){
            return undefined;
        }

        return res.data;
    }

    public downloadVersion(version: BSVersion, from: BsStore): Promise<BSVersion> {
        return this.getStoreDownloader(from).downloadBsVersion(version).finally(() => {
            this.resetDownloadState();
            this.versionManager.askInstalledVersions();
        });
    }

    public verifyBsVersion(version: BSVersion){
        this._isVerifying$.next(true);
        return this.getStoreDownloader(version.metadata.store).verifyBsVersion(version).finally(() => {
            this.resetDownloadState();
            this.versionManager.askInstalledVersions();
        });
    }

    public async stopDownload(): Promise<void> {
        return Promise.all([
            this.steamDownloader.stopDownload(),
            this.oculusDownloader.stopDownload()
        ]).then(() => {});
    }

}