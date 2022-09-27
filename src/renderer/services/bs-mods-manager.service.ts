import { BSVersion } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods/mod.interface";
import { IpcService } from "./ipc.service";

export class BsModsManagerService {

    private static instance: BsModsManagerService;

    private readonly ipcService: IpcService;

    public static getInstance(): BsModsManagerService{
        if(!BsModsManagerService.instance){ BsModsManagerService.instance = new BsModsManagerService(); }
        return BsModsManagerService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();
    }

    public getAvailableMods(version: BSVersion): Promise<Mod[]>{
        return this.ipcService.send<Mod[], BSVersion>("get-available-mods", {args: version}).then(res => res.data);
    }

    public getInstalledMods(version: BSVersion): Promise<Mod[]>{
        return this.ipcService.send<Mod[], BSVersion>("get-installed-mods", {args: version}).then(res => res.data);
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