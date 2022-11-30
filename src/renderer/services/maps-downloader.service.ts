import { BSVersion } from "shared/bs-version.interface";

export class MapsDownloaderService {

    private static instance: MapsDownloaderService;

    public static getInstance(): MapsDownloaderService{
        if(!MapsDownloaderService.instance){ MapsDownloaderService.instance = new MapsDownloaderService(); }
        return MapsDownloaderService.instance;
    }

    private constructor(){

    }

    public openDownloadMapModal(version?: BSVersion){
        
    }

}