import { BSVersion } from "shared/bs-version.interface";
import { InstallModsResult, ModInstallProgression, UninstallModsResult } from "shared/models/mods";
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
import recursiveReadDir from "recursive-readdir";
import { sToMs } from "../../../shared/helpers/time.helpers";
import { BsmZipExtractor } from "../../models/bsm-zip-extractor.class";
import { pathExistsSync, readdirSync, rm, unlink } from "fs-extra";
import { tryit } from "shared/helpers/error.helpers";
import crypto from "crypto";
import { BbmCategories, BbmFullMod, BbmModVersion } from "../../../shared/models/mods/mod.interface";

export class BsModsManagerService {
    private static instance: BsModsManagerService;

    private readonly beatModsApi: BeatModsApiService;
    private readonly bsLocalService: BSLocalVersionService;
    private readonly utilsService: UtilsService;
    private readonly requestService: RequestService;

    private manifestMatches: BbmModVersion[];

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
        this.utilsService = UtilsService.getInstance();
    }

    private async getModFromHash(hash: string): Promise<BbmModVersion | null> {
        try {
            const mod = await this.beatModsApi.getModByHash(hash);

            if(mod?.contentHashes?.some(content => content.path.includes("IPA.exe"))){
                return null;
            }

            return mod;
        } catch (error) {
            log.error("Could not get mod from hash", error);
            return null;
        }
    }

    private async getModsInDir(version: BSVersion, modsDir: ModsInstallFolder): Promise<BbmModVersion[]> {
        const bsPath = await this.bsLocalService.getVersionPath(version);
        const modsPath = path.join(bsPath, modsDir);

        if (!pathExistsSync(modsPath)) {
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

                if (filePath.toLowerCase().includes("libs")) {
                    const manifestIndex = this.manifestMatches.findIndex(m => m.id === mod.id);

                    if (manifestIndex < 0) {
                        return undefined;
                    }

                    this.manifestMatches.splice(manifestIndex, 1);
                }

                return mod;
        });

        const mods = await Promise.all(promises);
        return  mods.filter(Boolean);
    }

    private async getBsipaInstalled(version: BSVersion): Promise<BbmModVersion> {
        const bsPath = await this.bsLocalService.getVersionPath(version);
        const injectorPath = path.join(bsPath, "Beat Saber_Data", "Managed", "IPA.Injector.dll");
        if (!(await pathExist(injectorPath))) {
            return undefined;
        }
        const injectorMd5 = await md5File(injectorPath);
        return this.beatModsApi.getModByHash(injectorMd5);
    }

    private async downloadZip(zipUrl: string): Promise<BsmZipExtractor> {
        zipUrl = path.join(this.beatModsApi.MODS_REPO_URL, zipUrl);

        log.info("Download mod zip", zipUrl);

        const buffer = await lastValueFrom(this.requestService.downloadBuffer(zipUrl))
            .then(progress => progress.data)
            .catch((e: Error) => {
                log.error("ZIP", "Error while downloading zip", e);
            });

        if (!buffer) {
            return null;
        }

        return BsmZipExtractor.fromBuffer(buffer);
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

            log.info("START IPA PROCESS", `"${ipaPath}"`, args);
            const processIPA = spawn(`"${ipaPath}"`, args, { cwd: versionPath, detached: true, shell: true });

            const timemout = setTimeout(() => {
                log.info("Ipa process timeout");
                resolve(false)
            }, sToMs(30));

            processIPA.on("error", e => {
                log.error("Ipa process error", e);
                resolve(false);
            })

            processIPA.stderr.on("data", data => {
                log.error("Ipa process stderr", data.toString());
            });

            processIPA.once("exit", code => {
                clearTimeout(timemout);
                if (code === 0) {
                    log.info("Ipa process exist with code 0");
                    return resolve(true);
                }
                log.error("Ipa process exist with non 0 code", code);
                resolve(false);
            });


        });
    }

    private getModDownload(modVersion: BbmModVersion): string {
        return `/cdn/mod/${modVersion.zipHash}.zip`
    }

    private async installMod(mod: BbmFullMod, version: BSVersion): Promise<boolean> {
        log.info("INSTALL MOD", mod.mod.name, "for version", `${version.BSVersion} - ${version.name}`);
        this.utilsService.ipcSend<ModInstallProgression>("mod-installed", { success: true, data: { name: mod.mod.name, progression: ((this.nbInstalledMods + 1) / this.nbModsToInstall) * 100 } });

        const isBSIPA = mod.mod.name.toLowerCase() === "bsipa";

        if(isBSIPA){
            await this.clearIpaFolder(version).catch(e => log.error("Error while clearing IPA folder", e));
        }

        const downloadUrl = this.getModDownload(mod.version);

        if (!downloadUrl) {
            return false;
        }

        log.info("Start download mod zip", mod.mod.name, downloadUrl);
        const zip = await this.downloadZip(downloadUrl);
        log.info("Mod zip download end", mod.mod.name, downloadUrl);

        if (!zip) {
            return false;
        }

        let hashCount = 0;
        for await (const entry of zip.entries()) {
            const buffer = await entry.read();
            const md5Hash = crypto.createHash("md5")
                .update(buffer)
                .digest("hex");
            hashCount += +mod.version.contentHashes.some(content => content.hash === md5Hash);
        }

        if (hashCount !== mod.version.contentHashes.length) {
            return false;
        }

        const versionPath = await this.bsLocalService.getVersionPath(version);
        const destDir = isBSIPA ? versionPath : path.join(versionPath, ModsInstallFolder.PENDING);

        log.info("Start extracting mod zip", mod.mod.name, "to", destDir);
        const extracted = await zip.extract(destDir)
            .then(() => true)
            .catch(e => {
                log.error("Error while extracting mod zip", e);
                return false;
            })
            .finally(() => {
                zip.close();
            });

        log.info("Mod zip extraction end", mod.mod.name, "to", destDir, "success:", extracted);

        const res = isBSIPA
            ? extracted &&
              (await this.executeBSIPA(version, ["-n"]).catch(e => {
                  log.error(e);
                  return false;
              }))
            : extracted;

        res && this.nbInstalledMods++;

        return res;
    }

    private isDependency(mod: BbmFullMod, selectedMods: BbmFullMod[], availableMods: BbmFullMod[]): boolean {
        const selectedDepsIds = selectedMods.flatMap(mod => mod.version.dependencies);
        const modsDeps = availableMods.filter(m => selectedDepsIds.includes(m.version.id));
        const modsDepsDepsIds = modsDeps.flatMap(m => m.version.dependencies);
        return selectedDepsIds.includes(mod.version.id) || modsDepsDepsIds.includes(mod.version.id);
    }

    private async resolveDependencies(mods: BbmFullMod[], version: BSVersion): Promise<BbmFullMod[]> {
        const availableMods = await this.beatModsApi.getVersionMods(version);
        return Array.from(
            new Map<number, BbmFullMod>(
                availableMods.reduce((res, mod) => {
                    if (mod.mod.category === BbmCategories.Core || this.isDependency(mod, mods, availableMods)) {
                        res.push([mod.mod.id, mod]);
                    }
                    return res;
                }, [])
            ).values()
        );
    }

    private async clearIpaFolder(version: BSVersion): Promise<void> {
        log.info("Clearing IPA folder");

        const versionPath = await this.bsLocalService.getVersionPath(version);
        const ipaPath = path.join(versionPath, ModsInstallFolder.IPA);

        if(!pathExistsSync(ipaPath)){
            log.info("IPA folder does not exist, skipping");
            return;
        }

        const contents = readdirSync(ipaPath, { withFileTypes: true });

        for(const content of contents){

            if (content.name === 'Backups' || content.name === 'Pending') {
                continue;
            }

            const contentPath = path.join(ipaPath, content.name);

            const res = await tryit(() => content.isDirectory() ? (
                rm(contentPath, { force: true, recursive: true })
            ) : (
                unlink(contentPath)
            ));

            if(res.error){
                log.error("Error while clearing IPA folder content", content.name, res.error);
            }
        }

        log.info("IPA folder cleared successfully");
    }

    private async uninstallBSIPA(mod: BbmFullMod, version: BSVersion): Promise<void> {
        const verionPath = await this.bsLocalService.getVersionPath(version);
        const hasIPAExe = await pathExist(path.join(verionPath, "IPA.exe"));
        const hasIPADir = await pathExist(path.join(verionPath, "IPA"));

        if (!hasIPADir || !hasIPAExe) {
            return;
        }

        await this.executeBSIPA(version, ["--revert", "-n"]);

        const promises = mod.version.contentHashes.map(content => {
            const file = content.path.replaceAll("IPA/", "").replaceAll("Data", "Beat Saber_Data");
            return unlinkPath(path.join(verionPath, file));
        });

        await Promise.all(promises);
    }

    private async uninstallMod(mod: BbmFullMod, version: BSVersion): Promise<void> {
        this.nbUninstalledMods++;
        this.utilsService.ipcSend<ModInstallProgression>("mod-uninstalled", { success: true, data: { name: mod.mod.name, progression: (this.nbUninstalledMods / this.nbModsToUninstall) * 100 } });

        if (mod.mod.name.toLowerCase() === "bsipa") {
            return this.uninstallBSIPA(mod, version);
        }

        const versionPath = await this.bsLocalService.getVersionPath(version);

        const promises = mod.version.contentHashes.map(async content => {
            return Promise.all([unlinkPath(path.join(versionPath, content.path)), unlinkPath(path.join(versionPath, "IPA", "Pending", content.path))]);
        });

        await Promise.all(promises);
    }

    public async getAvailableMods(version: BSVersion): Promise<BbmFullMod[]> {
        return this.beatModsApi.getVersionMods(version).catch(() => {
            return [] as BbmFullMod[];
        });
    }

    public async getInstalledMods(version: BSVersion): Promise<BbmModVersion[]> {
        this.manifestMatches = [];

        const bsipa = await this.getBsipaInstalled(version);

        const pluginsMods = await Promise.all([this.getModsInDir(version, ModsInstallFolder.PLUGINS), this.getModsInDir(version, ModsInstallFolder.PLUGINS_PENDING)]);
        const libsMods = await Promise.all([this.getModsInDir(version, ModsInstallFolder.LIBS), this.getModsInDir(version, ModsInstallFolder.LIBS_PENDING)]);

        const dirMods = pluginsMods.flat().concat(libsMods.flat());

        const modsDict = new Map<number, BbmModVersion>();

        if (bsipa) {
            modsDict.set(bsipa.id, bsipa);
        }

        for (const mod of dirMods.flat()) {
            if (modsDict.has(mod.id)) {
                continue;
            }
            modsDict.set(mod.id, mod);
        }

        return Array.from(modsDict.values());
    }

    public async installMods(mods: BbmFullMod[], version: BSVersion): Promise<InstallModsResult> {
        const deps = await this.resolveDependencies(mods, version);
        mods.push(...deps);

        if (!mods?.length) {
            throw "no-mods";
        }

        const bsipa = mods.find(mod => mod.mod.name.toLowerCase() === "bsipa");
        if (bsipa) {
            mods = mods.filter(mod => mod.mod.name.toLowerCase() !== "bsipa");
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

    public async uninstallMods(mods: BbmFullMod[], version: BSVersion): Promise<UninstallModsResult> {
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
        const versionMods = await this.getAvailableMods(version);
        const installedMods = await this.getInstalledMods(version);

        const fullInstalledMods: BbmFullMod[] = installedMods?.map(version => {
            return { version, mod: versionMods.find(mod => version.modId === mod.mod.id)?.mod };
        }) ?? [];

        if (!fullInstalledMods?.length) {
            throw "no-mods";
        }

        this.nbModsToUninstall = fullInstalledMods.length;
        this.nbUninstalledMods = 0;

        for (const mod of fullInstalledMods) {
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
