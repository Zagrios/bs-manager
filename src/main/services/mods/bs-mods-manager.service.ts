import { BSVersion } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods/mod.interface";import { BeatModsApiService } from "./beat-mods-api.service";
import { BSLocalVersionService } from "../bs-local-version.service"
import path from "path";
import { UtilsService } from "../utils.service";
import md5File from "md5-file";
import fs from "fs"

export class BsModsManagerService {

    private static instance: BsModsManagerService;

    private beatModsApi: BeatModsApiService;
    private bsLocalService: BSLocalVersionService;
    private utilsService: UtilsService;

    private manifestMatches: Mod[];

    public static getInstance(): BsModsManagerService{
        if(!BsModsManagerService.instance){ BsModsManagerService.instance = new BsModsManagerService(); }
        return BsModsManagerService.instance;
    }

    private constructor(){
        this.beatModsApi = BeatModsApiService.getInstance();
        this.bsLocalService = BSLocalVersionService.getInstance();
        this.utilsService = UtilsService.getInstance();
    }

    private async getModFromHash(hash: string): Promise<Mod>{
        const allMods = await this.beatModsApi.getAllMods();
        return allMods.find(mod => {
            if(mod.name.toLowerCase() === "bsipa" || mod.status === "declined"){ return false; }
            return mod.downloads.some(download => download.hashMd5.some(md5 => md5.hash === hash));
        })
    }

    private async getIpaFromHash(hash: string): Promise<Mod>{
        const allMods = await this.beatModsApi.getAllMods();
        return allMods.find(mod => {
            if(mod.name.toLowerCase() !== "bsipa"){ return false; }
            return mod.downloads.some(download => download.hashMd5.some(md5 => md5.hash === hash));
        })
    }

    private async getModsInDir(version: BSVersion, modsDir: ModsInstallFolder): Promise<Mod[]>{
        const bsPath = await this.bsLocalService.getVersionPath(version);
        const modsPath = path.join(bsPath, modsDir);
        if(!this.utilsService.pathExist(modsPath)){ return []; }
        const files = fs.readdirSync(modsPath);
        const promises = files.map(f => {
            console.log()
            return (async() => {
                const filePath = path.join(modsPath, f)
                const ext = path.extname(f);
                if(ext !== ".dll" && ext !== ".exe" && ext !== ".manifest"){ return undefined; }
                const hash = await md5File(filePath);
                const mod = await this.getModFromHash(hash);
                if(!mod){ return undefined; }
                if(ext === ".manifest"){
                    this.manifestMatches.push(mod);
                    return undefined;
                }
                if(filePath.includes("Libs")){
                    if(!this.manifestMatches.some(m => m.name === mod.name)){ return undefined; }
                    const modIndex = this.manifestMatches.indexOf(mod);
                    if(modIndex > -1){ this.manifestMatches.splice(modIndex, 1); }
                }
                return mod;
            })()
        });
        const mods = await Promise.all(promises)
        return mods.filter(m => !!m);
    }

    private async getBsipaInstalled(version: BSVersion): Promise<Mod>{
        const bsPath = await this.bsLocalService.getVersionPath(version);
        const injectorPath = path.join(bsPath, "Beat Saber_Data", "Managed", "IPA.Injector.dll");
        if(!this.utilsService.pathExist(injectorPath)){ return undefined; }
        const injectorMd5 = await md5File(injectorPath);
        return this.getIpaFromHash(injectorMd5);
    }

    public getAvailableMods(version: BSVersion): Promise<Mod[]>{
        return this.beatModsApi.getVersionMods(version);
    }

    public async getInstalledMods(version: BSVersion): Promise<Mod[]>{
        this.manifestMatches = [];
        await this.beatModsApi.loadAllMods();
        const bsipa = await this.getBsipaInstalled(version);
        return Promise.all([
            this.getModsInDir(version, ModsInstallFolder.PLUGINS_PENDING),
            this.getModsInDir(version, ModsInstallFolder.LIBS_PENDING),
            this.getModsInDir(version, ModsInstallFolder.PLUGINS),
            this.getModsInDir(version, ModsInstallFolder.LIBS)
        ]).then(dirMods => {
            return [((!!bsipa) && bsipa), ...Array.from(new Map<string, Mod>(dirMods.flat().map(m => [m.name, m])).values())];
        })
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

const enum ModsInstallFolder {
    PLUGINS = "Plugins",
    LIBS = "Libs",
    PLUGINS_PENDING = "IPA/Pending/Plugins",
    LIBS_PENDING = "IPA/Pending/Libs"
}