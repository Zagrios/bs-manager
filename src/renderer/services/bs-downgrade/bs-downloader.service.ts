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
        this.steamDownloader = SteamDownloaderService.getInstance();
        this.oculusDownloader = OculusDownloaderService.getInstance();
    }

    public getLastStoreDownloadedFrom(): BsStore | undefined {
        const lastStore = this.config.get("lastStoreDownloadedFrom");

        if(!lastStore){
            return undefined;
        }

        return lastStore as BsStore;
    }

    public async chooseStoreToDownloadFrom(): Promise<BsStore | undefined> {
        const res = await this.modals.openModal(ChooseStore);

        if(res.exitCode !== ModalExitCode.COMPLETED){
            return undefined;
        }

        return res.data;
    }

    public async downloadVersion(version: BSVersion, from: BsStore): Promise<BSVersion | void> {
        
        if(from === BsStore.STEAM || !version.OculusBinaryId){
            return this.steamDownloader.downloadBsVersion(version);
        }

        if(from === BsStore.OCULUS){
            return this.oculusDownloader.downloadBsVersion(version);
        }
    }

    public importVersion(): void {
        // TODO : open Modal
        // Will replace method in SteamDownloaderService
    }

}