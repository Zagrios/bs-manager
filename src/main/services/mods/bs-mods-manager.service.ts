import { BSVersion } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods/mod.interface";import { BeatModsApiService } from "./beat-mods-api.service";
import { BSLocalVersionService } from "../bs-local-version.service"
import path from "path";
import { UtilsService } from "../utils.service";
import md5File from "md5-file";
import fs from "fs"
import StreamZip from "node-stream-zip";
import { RequestService } from "../request.service";

export class BsModsManagerService {

    private static instance: BsModsManagerService;

    private readonly beatModsApi: BeatModsApiService;
    private readonly bsLocalService: BSLocalVersionService;
    private readonly utilsService: UtilsService;
    private readonly requestService: RequestService

    private manifestMatches: Mod[];

    public static getInstance(): BsModsManagerService{
        if(!BsModsManagerService.instance){ BsModsManagerService.instance = new BsModsManagerService(); }
        return BsModsManagerService.instance;
    }

    private constructor(){
        this.beatModsApi = BeatModsApiService.getInstance();
        this.bsLocalService = BSLocalVersionService.getInstance();
        this.utilsService = UtilsService.getInstance();
        this.requestService = RequestService.getInstance();
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

    private downloadZip(zipUrl: string): Promise<StreamZip.StreamZipAsync>{
        zipUrl = path.join(this.beatModsApi.BEAT_MODS_URL, zipUrl);
        const fileName = path.basename(zipUrl);
        const tempPath = this.utilsService.getTempPath();
        this.utilsService.createFolderIfNotExist(this.utilsService.getTempPath());
        const dest = path.join(tempPath, fileName);
        return this.requestService.downloadFile(zipUrl, dest).then(zipPath => new StreamZip.async({file : zipPath}));
    }

    private executeBSIPA(version: BSVersion){

    }

    private installBSIPA(mod: Mod, version: BSVersion){
        this.installMod(mod, version).then(res => {
            this.executeBSIPA(version); //TODO
        })
    }

    public async installMod(mod: Mod, version: BSVersion): Promise<boolean>{
        const download = mod.downloads.find(download => {
            const type = download.type.toLowerCase()
            return type === "universal" || type === this.bsLocalService.getVersionType(version);
        });

        if(!download){ return false; }

        const zip = await this.downloadZip(download.url);

        if(!zip){ return false; }

        const crypto = require('crypto');
        const entries = await zip.entries();

        const checkedEntries = (await Promise.all(Object.values(entries).map(async (entry) => {
            if(!entry.isFile){ return undefined; }
            const data = await zip.entryData(entry);
            const entryMd5 = crypto.createHash('md5').update(data).digest('hex')
            return download.hashMd5.some(md5 => md5.hash === entryMd5) ? entry : undefined;
        }))).filter(entry => !!entry);

        if(checkedEntries.length != download.hashMd5.length){ return false; }

        const verionPath = await this.bsLocalService.getVersionPath(version);
        if(!this.utilsService.pathExist(verionPath)){ return false; }

        const destDir = mod.name.toLowerCase() === "bsipa" ? verionPath : path.join(verionPath, ModsInstallFolder.PENDING);

        await zip.extract(null, destDir);

        return true;
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
    PENDING = "IPA/Pending",
    PLUGINS_PENDING = "IPA/Pending/Plugins",
    LIBS_PENDING = "IPA/Pending/Libs"
}