import { DownloadMapsModal } from "renderer/components/modal/modal-types/download-maps-modal.component";
import { BSVersion } from "shared/bs-version.interface";
import { ModalResponse, ModalService } from "./modale.service";

export class MapsDownloaderService {

    private static instance: MapsDownloaderService;

    public static getInstance(): MapsDownloaderService{
        if(!MapsDownloaderService.instance){ MapsDownloaderService.instance = new MapsDownloaderService(); }
        return MapsDownloaderService.instance;
    }

    private readonly modals: ModalService;

    private constructor(){
        this.modals = ModalService.getInsance();
    }

    public openDownloadMapModal(version?: BSVersion): Promise<ModalResponse<void>>{
        
        return this.modals.openModal(DownloadMapsModal, version);

    }

}