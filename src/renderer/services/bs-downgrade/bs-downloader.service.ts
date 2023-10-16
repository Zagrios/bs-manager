import { BsStore } from "shared/models/bs-store.enum";
import { ConfigurationService } from "../configuration.service";
import { BehaviorSubject } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { ModalExitCode, ModalService } from "../modale.service";
import { ChooseStore } from "renderer/components/modal/modal-types/bs-downgrade/choose-store-modal.component";
import { SteamDownloaderService } from "./steam-downloader.service";
import { OculusDownloaderService } from "./oculus-downloader.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";

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
    private readonly oculusDownloader: OculusDownloaderService; // TODO : create oculus downloader

    private readonly downloadingVersion$ = new BehaviorSubject<BSVersion>(null); // <= TODO : will replace obs in SteamDownloaderService

    private constructor(){
        this.config = ConfigurationService.getInstance();
        this.modals = ModalService.getInstance();
    }

    public getLastStoreDownloadedFrom(): BsStore | undefined {
        const lastStore = this.config.get("lastStoreDownloadedFrom");

        if(!lastStore){
            return undefined;
        }

        return lastStore as BsStore;
    }

    private async chooseStoreToDownloadFrom(): Promise<BsStore | undefined> {
        const res = await this.modals.openModal(ChooseStore);

        if(res.exitCode !== ModalExitCode.COMPLETED){
            return undefined;
        }

        return res.data;
    }

    public async downloadVersion(version: BSVersion): Promise<BSVersion | undefined> {
        const store = this.getLastStoreDownloadedFrom() ?? await this.chooseStoreToDownloadFrom();
        
        if(store === BsStore.STEAM){
            return this.steamDownloader.downloadBsVersion(version);
        }

        if(store === BsStore.OCULUS){
            return this.oculusDownloader.downloadBsVersion(version);
        }

        return undefined
    }

    public importVersion(): void {
        // TODO : open Modal
        // Will replace method in SteamDownloaderService
    }

}