import { BSVersion } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods/mod.interface";import { BeatModsApiService } from "./beat-mods-api.service";
;

export class BsModsManagerService {

    private static instance: BsModsManagerService;

    private beatModsApi: BeatModsApiService;

    public static getInstance(): BsModsManagerService{
        if(!BsModsManagerService.instance){ BsModsManagerService.instance = new BsModsManagerService(); }
        return BsModsManagerService.instance;
    }

    private constructor(){
        this.beatModsApi = BeatModsApiService.getInstance();
    }

    public getAvailableMods(version: BSVersion): Promise<Mod[]>{
        return this.beatModsApi.getVersionMods(version);
    }

    public getInstalledMods(version: BSVersion): Promise<Mod[]>{
        throw "NOT IMPLEMENTED YET";
    }

    public installMods(mods: Mod[], version: BSVersion){
        throw "NOT IMPLEMENTED YET";
    }

    public uninstallMods(mods: Mod[], version: BSVersion){
        throw "NOT IMPLEMENTED YET";
    }

    public isModsAvailable(version: BSVersion): Promise<boolean>{
        throw "NOT IMPLEMENTED YET";
    }

}