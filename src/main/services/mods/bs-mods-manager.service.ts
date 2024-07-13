import { BSVersion } from "shared/bs-version.interface";
import { DownloadLink, InstallModsResult, Mod, ModInstallProgression, UninstallModsResult } from "shared/models/mods";
import { BeatModsApiService } from "./beat-mods-api.service";
import { BSLocalVersionService } from "../bs-local-version.service";
import path from "path";
import { UtilsService } from "../utils.service";
import md5File from "md5-file";
import { RequestService } from "../request.service";
import { spawn } from "child_process";
import { BS_EXECUTABLE } from "../../constants";
import log from "electron-log";
import { deleteFolder, pathExist, unlinkPath } from "../../helpers/fs.helpers";
import { lastValueFrom } from "rxjs";
import JSZip from "jszip";
import { extractZip } from "../../helpers/zip.helpers";
import recursiveReadDir from "recursive-readdir";
import { minToMs } from "../../../shared/helpers/time.helpers";
import { ensureDir } from "fs-extra";

export class BsModsManagerService {
    private static instance: BsModsManagerService;

    private readonly beatModsApi: BeatModsApiService;
    private readonly bsLocalService: BSLocalVersionService;
    private readonly utilsService: UtilsService;
    private readonly requestService: RequestService;

    private manifestMatches: Mod[];

    private nbModsToInstall = 0;
    private nbInstalledMods = 0;

    private nbModsToUninstall = 0;
    private nbUninstalledMods = 0;

    public static getInstance(): BsModsManagerService {
        if (!BsModsManagerService.instance) {
            BsModsManagerService.instance = new BsModsManagerService();
        }
        return BsModsManagerService.instance;
    }

    private constructor() {
        this.beatModsApi = BeatModsApiService.getInstance();
        this.bsLocalService = BSLocalVersionService.getInstance();
        this.utilsService = UtilsService.getInstance();
        this.requestService = RequestService.getInstance();
    }

    private async getModFromHash(hash: string): Promise<Mod> {

        const mod = await this.beatModsApi.getModByHash(hash);

        if(mod?.name?.toLowerCase() === "bsipa"){
            return undefined;
        }

        return mod;
    }

    private async getModsInDir(version: BSVersion, modsDir: ModsInstallFolder): Promise<Mod[]> {
        const bsPath = await this.bsLocalService.getVersionPath(version);
        const modsPath = path.join(bsPath, modsDir);

        if (!(await pathExist(modsPath))) {
            return [];
        }

        const files = await recursiveReadDir(modsPath);

        const promises = files.map(async filePath => {
                const ext = path.extname(filePath);

                if (ext !== ".dll" && ext !== ".exe" && ext !== ".manifest") {
                    return undefined;
                }
                const hash = await md5File(filePath);
                const mod = await this.getModFromHash(hash);

                if (!mod) {
                    return undefined;
                }
                if (ext === ".manifest") {
                    this.manifestMatches.push(mod);
                    return undefined;
                }
                if (filePath.includes("Libs")) {
                    if (!this.manifestMatches.some(m => m.name === mod.name)) {
                        return undefined;
                    }
                    const modIndex = this.manifestMatches.indexOf(mod);
                    if (modIndex > -1) {
                        this.manifestMatches.splice(modIndex, 1);
                    }
                }
                return mod;
        });

        const mods = await Promise.all(promises);
        return  mods.filter(Boolean);
    }

    private async getBsipaInstalled(version: BSVersion): Promise<Mod> {
        const bsPath = await this.bsLocalService.getVersionPath(version);
        const injectorPath = path.join(bsPath, "Beat Saber_Data", "Managed", "IPA.Injector.dll");
        if (!(await pathExist(injectorPath))) {
            return undefined;
        }
        const injectorMd5 = await md5File(injectorPath);
        return this.beatModsApi.getModByHash(injectorMd5);
    }

    private async downloadZip(zipUrl: string): Promise<JSZip> {
        zipUrl = path.join(this.beatModsApi.BEAT_MODS_URL, zipUrl);

        log.info("Download mod zip", zipUrl);

        const buffer = await lastValueFrom(this.requestService.downloadBuffer(zipUrl))
            .then(progress => progress.data)
            .catch(e => {
                log.error("ZIP", "Error while downloading zip", e);
                return undefined;
            });

        if (!buffer) {
            return null;
        }

        return JSZip.loadAsync(buffer).catch(e => {
            log.error("ZIP", "Error while loading zip", e);
            return null;
        });
    }

    private async executeBSIPA(version: BSVersion, args: string[]): Promise<boolean> {

        log.info("executeBSIPA", version?.BSVersion, args);

        const versionPath = await this.bsLocalService.getVersionPath(version);
        const ipaPath = path.join(versionPath, "IPA.exe");
        const bsExePath = path.join(versionPath, BS_EXECUTABLE);
        if (!(await pathExist(ipaPath)) || !(await pathExist(bsExePath))) {
            log.error("IPA.exe or Beat Saber.exe not found");
            return false;
        }

        return new Promise<boolean>(resolve => {
            const cmd = process.platform === 'linux'
                ? `screen -dmS "BSIPA" dotnet ${ipaPath} ${args.join(" ")}` // Must run through screen, otherwise BSIPA tries to move console cursor and crashes.
                : `start /wait /min "" "${ipaPath}" ${args.join(" ")}`;

            log.info("START IPA PROCESS", cmd);
            const processIPA = spawn(cmd, { cwd: versionPath, detached: true, shell: true });

            processIPA.once("exit", code => {
                if (code === 0) {
                    log.info("Ipa process exist with code 0");
                    return resolve(true);
                }
                log.error("Ipa process exist with non 0 code", code);
                resolve(false);
            });

            setTimeout(() => {
                log.info("Ipa process timeout");
                resolve(false)
            }, minToMs(1));
        });
    }

    private getModDownload(mod: Mod, version: BSVersion): DownloadLink {
        return mod.downloads.find(download => {
            const type = download.type.toLowerCase();
            return type === "universal" || type === this.bsLocalService.getVersionType(version);
        });
    }

    private async installMod(mod: Mod, version: BSVersion): Promise<boolean> {
        log.info("INSTALL MOD", mod.name, "for version", `${version.BSVersion} - ${version.name}`);
        this.utilsService.ipcSend<ModInstallProgression>("mod-installed", { success: true, data: { name: mod.name, progression: ((this.nbInstalledMods + 1) / this.nbModsToInstall) * 100 } });

        const download = this.getModDownload(mod, version);

        if (!download) {
            return false;
        }

        log.info("Start download mod zip", mod.name, download.url);
        const zip = await this.downloadZip(download.url);
        log.info("Mod zip download end", mod.name, download.url, !!zip);

        if (!zip) {
            return false;
        }

        const crypto = require("crypto");
        const files = await zip.files;

        const checkedEntries = (
            await Promise.all(
                Object.values(files).map(async entry => {
                    const data = await entry.async("nodebuffer");
                    const entryMd5 = crypto.createHash("md5").update(data).digest("hex");
                    return download.hashMd5.some(md5 => md5.hash === entryMd5) ? entry : undefined;
                })
            ).catch(e => {
                log.error("Error while checking mod zip entries", mod.name, e);
                throw e;
            })
        ).filter(entry => !!entry);

        if (checkedEntries.length !== download.hashMd5.length) {
            return false;
        }

        const verionPath = await this.bsLocalService.getVersionPath(version);
        const isBSIPA = mod.name.toLowerCase() === "bsipa";
        const destDir = isBSIPA ? verionPath : path.join(verionPath, ModsInstallFolder.PENDING);

        await ensureDir(destDir);
        log.info("Start extracting mod zip", mod.name, "to", destDir);
        const extracted = await extractZip(zip, destDir)
            .then(() => true)
            .catch(e => {
                log.error("Error while extracting mod zip", e);
                return false;
            });

        log.info("Mod zip extraction end", mod.name, "to", destDir, "success:", extracted);

        const res = isBSIPA
            ? extracted &&
              (await this.executeBSIPA(version, ["-n"]).catch(e => {
                  log.error(e);
                  return false;
              }))
            : extracted;

        if(res){
            this.nbInstalledMods++;
        }

        return res;
    }

    private isDependency(mod: Mod, selectedMods: Mod[], availableMods: Mod[]) {
        return selectedMods.some(m => {
            const deps = m.dependencies.map(dep => Array.from(availableMods.values()).find(m => dep.name === m.name));
            if (deps.some(depMod => depMod.name === mod.name)) {
                return true;
            }
            return deps.some(depMod => depMod.dependencies.some(depModDep => depModDep.name === mod.name));
        });
    }

    private async resolveDependencies(mods: Mod[], version: BSVersion): Promise<Mod[]> {
        const availableMods = await this.beatModsApi.getVersionMods(version);
        return Array.from(
            new Map<string, Mod>(
                availableMods.reduce((res, mod) => {
                    if (this.isDependency(mod, mods, availableMods)) {
                        res.push([mod.name, mod]);
                    }
                    return res;
                }, [])
            ).values()
        );
    }

    private async uninstallBSIPA(mod: Mod, version: BSVersion): Promise<void> {
        const download = this.getModDownload(mod, version);

        const verionPath = await this.bsLocalService.getVersionPath(version);
        const hasIPAExe = await pathExist(path.join(verionPath, "IPA.exe"));
        const hasIPADir = await pathExist(path.join(verionPath, "IPA"));

        if (!hasIPADir || !hasIPAExe) {
            return;
        }

        await this.executeBSIPA(version, ["--revert", "-n"]);

        const promises = download.hashMd5.map(files => {
            const file = files.file.replaceAll("IPA/", "").replaceAll("Data", "Beat Saber_Data");
            return unlinkPath(path.join(verionPath, file));
        });

        await Promise.all(promises);
    }

    private async uninstallMod(mod: Mod, version: BSVersion): Promise<void> {
        this.nbUninstalledMods++;
        this.utilsService.ipcSend<ModInstallProgression>("mod-uninstalled", { success: true, data: { name: mod.name, progression: (this.nbUninstalledMods / this.nbModsToUninstall) * 100 } });

        if (mod.name.toLowerCase() === "bsipa") {
            return this.uninstallBSIPA(mod, version);
        }

        const download = this.getModDownload(mod, version);
        const versionPath = await this.bsLocalService.getVersionPath(version);

        const promises = download.hashMd5.map(async files => {
            return Promise.all([unlinkPath(path.join(versionPath, files.file)), unlinkPath(path.join(versionPath, "IPA", "Pending", files.file))]);
        });

        await Promise.all(promises);
    }

    public getAvailableMods(version: BSVersion): Promise<Mod[]> {
        return this.beatModsApi.getVersionMods(version);
    }

    public async getInstalledMods(version: BSVersion): Promise<Mod[]> {
        this.manifestMatches = [];

        const bsipa = await this.getBsipaInstalled(version);


        return Promise.all([this.getModsInDir(version, ModsInstallFolder.PLUGINS_PENDING), this.getModsInDir(version, ModsInstallFolder.LIBS_PENDING), this.getModsInDir(version, ModsInstallFolder.PLUGINS), this.getModsInDir(version, ModsInstallFolder.LIBS)]).then(dirMods => {
            const modsDict = new Map<string, Mod>();

            if (bsipa) {
                modsDict.set(bsipa.name, bsipa);
            }

            for (const mod of dirMods.flat()) {
                if (modsDict.has(mod.name)) {
                    continue;
                }
                modsDict.set(mod.name, mod);
            }

            return Array.from(modsDict.values());
        });
    }

    public async installMods(mods: Mod[], version: BSVersion): Promise<InstallModsResult> {
        if (!mods?.length) {
            throw "no-mods";
        }

        const deps = await this.resolveDependencies(mods, version);
        mods.push(...deps);

        const bsipa = mods.find(mod => mod.name.toLowerCase() === "bsipa");
        if (bsipa) {
            mods = mods.filter(mod => mod.name.toLowerCase() !== "bsipa");
        }

        this.nbModsToInstall = mods.length + (bsipa && 1);
        this.nbInstalledMods = 0;

        if (bsipa) {
            const installed = await this.installMod(bsipa, version).catch(err => {
                log.error("INSTALL BSIPA", err);
                return false;
            });
            if (!installed) {
                throw "cannot-install-bsipa";
            }
        }

        for (const mod of mods) {
            await this.installMod(mod, version);
        }

        return {
            nbModsToInstall: this.nbModsToInstall,
            nbInstalledMods: this.nbInstalledMods,
        };
    }

    public async uninstallMods(mods: Mod[], version: BSVersion): Promise<UninstallModsResult> {
        if (!mods?.length) {
            throw "no-mods";
        }

        this.nbModsToUninstall = mods.length;
        this.nbUninstalledMods = 0;

        for (const mod of mods) {
            await this.uninstallMod(mod, version);
        }

        return {
            nbModsToUninstall: this.nbModsToUninstall,
            nbUninstalledMods: this.nbUninstalledMods,
        };
    }

    public async uninstallAllMods(version: BSVersion): Promise<UninstallModsResult> {
        const mods = await this.getInstalledMods(version);

        if (!mods?.length) {
            throw "no-mods";
        }

        this.nbModsToUninstall = mods.length;
        this.nbUninstalledMods = 0;

        for (const mod of mods) {
            await this.uninstallMod(mod, version);
        }

        const versionPath = await this.bsLocalService.getVersionPath(version);

        await deleteFolder(path.join(versionPath, ModsInstallFolder.PLUGINS));
        await deleteFolder(path.join(versionPath, ModsInstallFolder.LIBS));
        await deleteFolder(path.join(versionPath, ModsInstallFolder.IPA));

        return {
            nbModsToUninstall: this.nbModsToUninstall,
            nbUninstalledMods: this.nbUninstalledMods,
        };
    }
}

const enum ModsInstallFolder {
    PLUGINS = "Plugins",
    LIBS = "Libs",
    IPA = "IPA",
    PENDING = "IPA/Pending",
    PLUGINS_PENDING = "IPA/Pending/Plugins",
    LIBS_PENDING = "IPA/Pending/Libs",
}
