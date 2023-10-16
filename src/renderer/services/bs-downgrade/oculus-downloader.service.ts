import { BSVersion } from "shared/bs-version.interface";

export class OculusDownloaderService {

    private static instance: OculusDownloaderService;

    public static getInstance(): OculusDownloaderService {
        if (!OculusDownloaderService.instance) {
            OculusDownloaderService.instance = new OculusDownloaderService();
        }

        return OculusDownloaderService.instance;
    }

    private constructor(){}

    public async downloadBsVersion(version: BSVersion): Promise<BSVersion> {
        return version;
    }

}