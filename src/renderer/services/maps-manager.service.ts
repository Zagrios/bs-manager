import { BSVersion } from "shared/bs-version.interface";

export class MapsManagerService {

    private static instance: MapsManagerService;

    public static getInstance(): MapsManagerService{
        if(!MapsManagerService.instance){ MapsManagerService.instance = new MapsManagerService() }
        return MapsManagerService.instance;
    }

    private constructor(){

    }

    public getMaps(version?: BSVersion): any[]{
        return [];
    }

    public downloadMap(map: any, version?: BSVersion){

    }

    public deleteMaps(maps: any[], version?: BSVersion){

    }



}