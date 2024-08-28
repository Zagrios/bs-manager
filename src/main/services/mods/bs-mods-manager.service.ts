import { BSVersion } from "shared/bs-version.interface";
import { DownloadLink, InstallModsResult, Mod, ModInstallProgression, UninstallModsResult } from "shared/models/mods";
import { BeatModsApiService } from "./beat-mods-api.service";
import { BSLocalVersionService } from "../bs-local-version.service";
import path from "path";
import { UtilsService } from "../utils.service";
import md5Hash from "crypto-js/md5";
import md5File from "md5-file";
import { RequestService } from "../request.service";
import { spawn } from "child_process";
import { BS_EXECUTABLE } from "../../constants";
import log from "electron-log";
import { deleteFolder, pathExist, unlinkPath } from "../../helpers/fs.helpers";
import { lastValueFrom } from "rxjs";
import JSZip from "jszip";
import { extractZip, getFilenames, toZip } from "../../helpers/zip.helpers";
import recursiveReadDir from "recursive-readdir";
import { sToMs } from "../../../shared/helpers/time.helpers";
import { copyFile, ensureDir, mkdir, pathExistsSync, readFile, unlink, writeFile } from "fs-extra";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { ExternalMod, ExternalModFile, ExternalModFileVerify } from "shared/models/mods/mod.interface";


interface ModsConfig {
    mods: { [key: string]: ExternalMod; };
    files: {
        Plugins: { [key: string]: string };
        Libs: { [key: string]: string };
    }
};

export class BsModsManagerService {
    private static instance: BsModsManagerService;

    private readonly MODS_FILE = "mods.json"

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
                    const manifestIndex = this.manifestMatches.findIndex(m => m.name === mod.name);

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
                ? `screen -dmS "BSIPA" dotnet "${ipaPath}" ${args.join(" ")}` // Must run through screen, otherwise BSIPA tries to move console cursor and crashes.
                : `"${ipaPath}" ${args.join(" ")}`;

            log.info("START IPA PROCESS", cmd);
            const processIPA = spawn(cmd, { cwd: versionPath, detached: true, shell: true });

            const timemout = setTimeout(() => {
                log.info("Ipa process timeout");
                resolve(false)
            }, sToMs(30));

            processIPA.stderr.on("data", data => {
                log.error("IPA process stderr", data.toString());
            })

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

        const pluginsMods = await Promise.all([this.getModsInDir(version, ModsInstallFolder.PLUGINS), this.getModsInDir(version, ModsInstallFolder.PLUGINS_PENDING)]);
        const libsMods = await Promise.all([this.getModsInDir(version, ModsInstallFolder.LIBS), this.getModsInDir(version, ModsInstallFolder.LIBS_PENDING)]);

        const dirMods = pluginsMods.flat().concat(libsMods.flat());

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
    }

    public async installMods(mods: Mod[], version: BSVersion): Promise<InstallModsResult> {
        if (!mods?.length) {
            throw CustomError.fromError(new Error("No mods to install"), "no-mods");
        }

        const bsipa = mods.find(mod => mod.name.toLowerCase() === "bsipa");
        if (bsipa) {
            mods = mods.filter(mod => mod.name.toLowerCase() !== "bsipa");
        }

        this.nbModsToInstall = mods.length + (bsipa ? 1 : 0);
        this.nbInstalledMods = 0;

        if (bsipa) {
            const installed = await this.installMod(bsipa, version).catch(err => {
                log.error("INSTALL BSIPA", err);
                return false;
            });
            if (!installed) {
                throw CustomError.fromError(new Error("Unable to install BSIPA"), "cannot-install-bsipa");
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

    // NOTE: Only supports external mods for now
    public async toggleMods(externalMods: ExternalMod[], version: BSVersion): Promise<ExternalMod[]> {
        if (externalMods.length === 0) {
            throw CustomError.fromError(
                new Error("No mods to enable/disable"),
                "no-mods-toggled"
            );
        }

        log.info(`Toggling mods for "${version.BSVersion} - ${version.name}"`, externalMods);

        this.nbModsToInstall = externalMods.length;
        this.nbInstalledMods = 0;

        const editedMods: ExternalMod[] = [];
        const versionPath = await this.bsLocalService.getVersionPath(version);
        const modsPath = this.getExternalModsPath(versionPath);
        const modsConfig = await this.getExternalModsConfig(modsPath);
        for (const mod of externalMods) {
            this.utilsService.ipcSend<ModInstallProgression>("mod-installed", {
                success: true,
                data: {
                    name: mod.name,
                    progression: ((this.nbInstalledMods + 1) / this.nbModsToInstall) * 100
                }
            });

            if (modsConfig.mods[mod.id].enabled === mod.enabled) {
                ++this.nbInstalledMods;
                continue;
            }

            if (mod.enabled) {
                await this.enableExternalMod(mod, versionPath);
            } else {
                await this.disableExternalMod(mod, versionPath);
            }

            modsConfig.mods[mod.id] = mod;
            editedMods.push(mod);
            ++this.nbInstalledMods;
        }

        log.info("Updating mods.json file");
        await writeFile(modsPath, JSON.stringify(modsConfig));

        return editedMods;
    }

    public async uninstallMods(mods: Mod[], externalMods: ExternalMod[], version: BSVersion): Promise<UninstallModsResult> {
        this.nbUninstalledMods = 0;
        this.nbModsToUninstall = (mods?.length || 0) + (externalMods?.length || 0);
        if (this.nbModsToUninstall === 0) {
            throw CustomError.fromError(new Error("No mods to uninstall"), "no-mods");
        }

        log.info(`Uninstalling mods on version "${version.BSVersion} - ${version.name}"`, mods, externalMods);

        for (const mod of mods) {
            await this.uninstallMod(mod, version);
        }

        if (externalMods.length > 0) {
            const versionPath = await this.bsLocalService.getVersionPath(version);
            const modsPath = this.getExternalModsPath(versionPath);
            let modsConfig = await this.getExternalModsConfig(modsPath);

            for (const mod of externalMods) {
                modsConfig = await this.uninstallExternalMod(mod, versionPath, modsConfig);
            }

            await writeFile(modsPath, JSON.stringify(modsConfig));
        }

        log.info(`Finished uninstalling mods "${version.BSVersion} - ${version.name}"`);

        return {
            nbModsToUninstall: this.nbModsToUninstall,
            nbUninstalledMods: this.nbUninstalledMods,
        };
    }

    public async uninstallAllMods(version: BSVersion): Promise<UninstallModsResult> {
        const mods = await this.getInstalledMods(version);
        const externalMods = Object.values(await this.getInstalledExternalMods(version));

        this.nbUninstalledMods = 0;
        this.nbModsToUninstall = mods.length + externalMods.length;
        if (this.nbModsToUninstall === 0) {
            throw CustomError.fromError(new Error("This version has to mods to uninstall"), "no-mods");
        }

        for (const mod of mods) {
            await this.uninstallMod(mod, version);
        }

        const versionPath = await this.bsLocalService.getVersionPath(version);
        if (externalMods.length > 0) {
            const modsPath = this.getExternalModsPath(versionPath);
            let modsConfig = await this.getExternalModsConfig(modsPath);

            for (const mod of externalMods) {
                modsConfig = await this.uninstallExternalMod(mod, versionPath, modsConfig);
            }

            await writeFile(modsPath, JSON.stringify(modsConfig));
        }

        await deleteFolder(path.join(versionPath, ModsInstallFolder.PLUGINS));
        await deleteFolder(path.join(versionPath, ModsInstallFolder.LIBS));
        await deleteFolder(path.join(versionPath, ModsInstallFolder.IPA));
        await deleteFolder(path.join(versionPath, "Disabled"));

        return {
            nbModsToUninstall: this.nbModsToUninstall,
            nbUninstalledMods: this.nbUninstalledMods,
        };
    }


    /* ** External Mods Handling ** */

    private getExternalModsPath(versionPath: string): string {
        return path.join(versionPath, this.MODS_FILE);
    }

    private async getExternalModsConfig(
        modsPath: string
    ): Promise<ModsConfig> {
        const modsConfig = pathExistsSync(modsPath)
            ? JSON.parse(await readFile(modsPath, "utf-8"))
            : { mods: {}, files: { Plugins: {}, Libs: {} } };

        if (!modsConfig.mods) modsConfig.mods = {};
        if (!modsConfig.files) modsConfig.files = { Plugins: {}, Libs: {} };

        return modsConfig;
    }

    private async updateExternalModsConfig(
        versionPath: string,
        mod: ExternalMod,
        files: {
            Plugins: { [key: string]: string };
            Libs: { [key: string]: string };
        }
    ): Promise<void> {
            const modsPath = this.getExternalModsPath(versionPath);
            const modsConfig = await this.getExternalModsConfig(modsPath);

            if (modsConfig.mods[mod.id]) {
                const ref = modsConfig.mods[mod.id].files;
                for (const file of mod.files) {
                    const index = ref.findIndex(f => f.name === file.name);
                    if (index > -1) {
                        ref[index] = file;
                    } else {
                        ref.push(file);
                    }
                }
                mod.files = modsConfig.mods[mod.id].files;
            }
            modsConfig.mods[mod.id] = mod;
            modsConfig.files.Plugins = { ...modsConfig.files.Plugins, ...files.Plugins };
            modsConfig.files.Libs = { ...modsConfig.files.Libs, ...files.Libs };

            await writeFile(modsPath, JSON.stringify(modsConfig));
    }

    private async prepareExternalModFolders(versionPath: string): Promise<void> {
        log.info("Creating external mod folders");
        await mkdir(path.join(versionPath, ModsInstallFolder.PLUGINS), { recursive: true });
        await mkdir(path.join(versionPath, ModsInstallFolder.LIBS), { recursive: true });
        await mkdir(path.join(versionPath, ModsInstallFolder.DISABLED_PLUGINS), { recursive: true });
        await mkdir(path.join(versionPath, ModsInstallFolder.DISABLED_LIBS), { recursive: true });
    }

    private async enableExternalMod(mod: ExternalMod, versionPath: string): Promise<void> {
        log.info(`Enabling mod ${mod.name} (${mod.id})`);

        // Move all non-disabled mods to Disabled Folder
        for (const file of mod.files) {
            if (!file.enabled) {
                continue;
            }

            const sourcePath = path.join(versionPath, ModsInstallFolder.DISABLED, file.folder, file.name);
            const destinationPath = path.join(versionPath, file.folder, file.name);
            log.info(`Moving file "${sourcePath}" => "${destinationPath}"`);
            await move(sourcePath, destinationPath);
        }
    }

    private async disableExternalMod(mod: ExternalMod, versionPath: string): Promise<void> {
        log.info(`Disabling mod ${mod.name} (${mod.id})`);

        // Move all non-disabled mods to Plugins/Libs Folder
        for (const file of mod.files) {
            if (!file.enabled) {
                continue;
            }

            const sourcePath = path.join(versionPath, file.folder, file.name);
            const destinationPath = path.join(versionPath, ModsInstallFolder.DISABLED, file.folder, file.name);
            log.info(`Moving file "${sourcePath}" => "${destinationPath}"`);
            await move(sourcePath, destinationPath);
        }
    }

    private async uninstallExternalMod(mod: ExternalMod, versionPath: string, modsConfig: ModsConfig): Promise<ModsConfig> {
        this.nbUninstalledMods++;
        if (!modsConfig.mods[mod.id]) {
            log.info("Mod does not exists");
            return modsConfig;
        }

        mod = modsConfig.mods[mod.id];
        log.info(`Uninstalling mod ${mod.name} (${mod.id})`);

        this.utilsService.ipcSend<ModInstallProgression>("mod-uninstalled", {
            success: true,
            data: {
                name: mod.name,
                progression: (this.nbUninstalledMods / this.nbModsToUninstall) * 100
            }
        });

        for (const file of mod.files) {
            const filepath = file.enabled
                ? path.join(versionPath, ModsInstallFolder.PLUGINS, file.name)
                : path.join(versionPath, "Disabled", ModsInstallFolder.PLUGINS, file.name);
            log.info(`Deleting file ${filepath}`);
            await unlinkPath(filepath);
            delete modsConfig.files[file.folder][file.name];
        }
        delete modsConfig.mods[mod.id];

        return modsConfig;
    }

    public async getInstalledExternalMods(version: BSVersion): Promise<{ [key: string]: ExternalMod }> {
        log.info(`Getting installed external mods for "${version.BSVersion} - ${version.name}"`);

        try {
            const versionPath = await this.bsLocalService.getVersionPath(version);
            const modsJsonPath = this.getExternalModsPath(versionPath);
            if (!pathExistsSync(modsJsonPath)) {
                return {};
            }

            const modsJson = JSON.parse(await readFile(modsJsonPath, "utf-8"));

            return modsJson.mods || {};
        } catch (error) {
            log.error(`Can't get installed external mods for ${version.BSVersion} - ${version.name}`, error);
            return {};
        }
    }

    private async getExternalDllMod(filepath: string, modsConfig: ModsConfig): Promise<ExternalModFileVerify> {
        const name = path.basename(filepath);
        const content = await readFile(filepath);
        return {
            name,
            folder: "Plugins",
            enabled: true,
            hash: md5Hash(content.toString()).toString(),
            conflicts: modsConfig.files.Plugins[name]
        };
    }

    private async getExternalZipMods(filepath: string, modsConfig: ModsConfig): Promise<ExternalModFileVerify[]> {
        try {
            const zip = await toZip(filepath);
            const filenames = (await getFilenames(zip))
                .filter(name => (
                    name.split(path.sep).length === 2 && // Folder depth of 2
                    (name.startsWith(ModsInstallFolder.LIBS) || name.startsWith(ModsInstallFolder.PLUGINS))
                ));

            // Check if there is a single .dll file
            let hasDll = false;
            for (const filename of filenames) {
                if (path.extname(filename) === ".dll") {
                    hasDll = true;
                    break;
                }
            }

            if (!hasDll) {
                log.warn(`Zip file ${filepath} does not contain any dll files`);
                return [];
            }

            const externalModFiles: ExternalModFileVerify[] = [];
            for (const filepath of filenames) {
                const name = path.basename(filepath);
                const folder = path.dirname(filepath) as "Plugins" | "Libs";
                const content = await zip.file(filepath).async("string");
                externalModFiles.push({
                    name,
                    folder,
                    enabled: true,
                    hash: md5Hash(content).toString(),
                    conflicts: modsConfig.files[folder][name] as string
                });
            }
            return externalModFiles;
        } catch (error) {
            log.error(`Could not read zip file ${path}`, error);
            return [];
        }
    }

    public async verifyExternalModFiles(version: BSVersion, files: string[]): Promise<ExternalModFileVerify[]> {
        log.info("Verifying files", files);

        const versionPath = await this.bsLocalService.getVersionPath(version);
        const modsPath = this.getExternalModsPath(versionPath);
        const modsConfig = await this.getExternalModsConfig(modsPath);

        let filenames: ExternalModFileVerify[] = [];
        for (const filepath of files) {
            switch(path.extname(filepath)) {
            case ".dll":
                filenames.push(await this.getExternalDllMod(filepath, modsConfig));
                break;

            case ".zip":
                filenames = filenames.concat(await this.getExternalZipMods(filepath, modsConfig));
                break;

            default:
                break;
            }
        }

        log.info("Verified files", filenames);
        return filenames;
    }

    private async installExternalModByZip(
        version: BSVersion,
        mod: ExternalMod,
        zip: JSZip,
        zipPath: string
    ): Promise<ExternalMod> {
        log.info("Install external mod with zip");

        try {
            if (!mod.id) {
                mod.id = crypto.randomUUID()
            }

            const copiedFiles: {
                Plugins: { [key: string]: string };
                Libs: { [key: string]: string };
            } = {
                Plugins: {},
                Libs: {},
            };

            const versionPath = await this.bsLocalService.getVersionPath(version);
            this.prepareExternalModFolders(versionPath);

            // Extract the files to the installation folder
            let sourcePath: string = "";
            let destinationPath: string = "";
            let deletePath: string = ""; // Delete existing from the other path
            for (const file of mod.files) {
                sourcePath = path.join(file.folder, file.name);

                if (file.enabled) {
                    destinationPath = path.join(versionPath, sourcePath);
                    deletePath = path.join(versionPath, "Disabled", sourcePath);
                } else {
                    destinationPath = path.join(versionPath, "Disabled", sourcePath);
                    deletePath = path.join(versionPath, sourcePath);
                }

                const content = await zip.file(sourcePath).async("nodebuffer");
                await writeFile(destinationPath, content);
                if (pathExistsSync(deletePath)) {
                    log.info(`Deleting file "${deletePath}"`);
                    await unlink(deletePath);
                }

                // Overwrite the id instead of creating a new one
                file.id = crypto.randomUUID();
                copiedFiles[file.folder][file.name] = mod.id;
            }

            await this.updateExternalModsConfig(versionPath, mod, copiedFiles);

            log.info("Custom mod installed", mod);
        } catch (error) {
            delete mod.id;
            log.error(`Could not install mod ${mod.name} with ${zipPath}`, error);
        }

        return mod;
    }

    private async installExternalModByMultipleFiles(
        version: BSVersion,
        mod: ExternalMod,
        files: string[]
    ): Promise<ExternalMod> {
        log.info("Installing external mod with files");

        try {
            if (!mod.id) {
                mod.id = crypto.randomUUID()
            }

            const copiedFiles: {
                Plugins: { [key: string]: string };
                Libs: { [key: string]: string };
            } = {
                Plugins: {},
                Libs: {},
            };

            const versionPath = await this.bsLocalService.getVersionPath(version);
            this.prepareExternalModFolders(versionPath);

            // Copy the files to the installation folder
            let destinationPath: string = "";
            let deletePath: string = "";
            for (const sourcePath of files) {
                const filename = path.basename(sourcePath);
                const file = mod.files.find(file => file.name === filename);
                if (!file) {
                    continue;
                }

                if (file.enabled) {
                    destinationPath = path.join(versionPath, file.folder, file.name);
                    deletePath = path.join(
                        versionPath, "Disabled", file.folder, file.name
                    );
                } else {
                    destinationPath = path.join(
                        versionPath, "Disabled", file.folder, file.name
                    );
                    deletePath = path.join(versionPath, file.folder, file.name);
                }

                log.info(`Copying file "${sourcePath}" => "${destinationPath}"`);
                await copyFile(sourcePath, destinationPath);
                if (pathExistsSync(deletePath)) {
                    log.info(`Deleting file "${deletePath}"`);
                    await unlink(deletePath);
                }

                // Overwrite the id instead of creating a new one
                file.id = crypto.randomUUID();
                copiedFiles[file.folder][file.name] = mod.id;
            }

            await this.updateExternalModsConfig(versionPath, mod, copiedFiles);

            log.info("Custom mod installed", mod);
        } catch (error) {
            delete mod.id;
            log.error(`Could not install mod ${mod.name}`, error);
        }

        return mod;
    }

    public async installExternalMod(mod: ExternalMod, version: BSVersion, files: string[]): Promise<ExternalMod> {
        if (!mod.name) {
            log.error("Name should not be empty");
            delete mod.id;
            return mod;
        }

        log.info(`Installing "${mod.name}" mod from "${version.BSVersion} - ${version.name}" version`, files);

        if (files.length === 0 || mod.files.length === 0) {
            log.error(`No mod files were passed for mod ${mod.name}`);
            delete mod.id;
            return mod;
        }

        if (files.length === 1 && path.extname(files[0]) === ".zip") {
            return this.installExternalModByZip(version, mod, await toZip(files[0]), files[0]);
        }

        return this.installExternalModByMultipleFiles(version, mod, files);
    }

    public async updateExternalMod(mod: ExternalMod, version: BSVersion): Promise<ExternalMod> {
        if (!mod.name) {
            log.error("Name should not be empty");
            delete mod.id;
            return mod;
        }

        log.info(`Updating "${mod.name}" mod from "${version.BSVersion} - ${version.name}"`);

        const versionPath = await this.bsLocalService.getVersionPath(version);
        const modsPath = this.getExternalModsPath(versionPath);
        const modsConfig = await this.getExternalModsConfig(modsPath);

        const modRef = modsConfig.mods[mod.id];
        modRef.name = mod.name;
        modRef.version = mod.version;
        modRef.description = mod.description;

        // Force enable
        modRef.enabled = true;
        mod.enabled = true;

        const fileMap = modRef.files.reduce((map, file) => {
            map[file.id] = file;
            return map;
        }, {} as { [key: string]: ExternalModFile });

        // Enable/Disable mod files
        const removeFileIds: string[] = [];
        let sourcePath: string = "";
        let destinationPath: string = "";
        for (const file of mod.files) {
            const fileRef = fileMap[file.id];
            if (!fileRef) { // NOTE: Does not support file upload on modal yet
                removeFileIds.push(file.id);
                continue;
            }

            if (file.enabled === fileRef.enabled) {
                continue;
            }

            if (file.enabled) {
                sourcePath = path.join(versionPath, ModsInstallFolder.DISABLED, file.folder, file.name);
                destinationPath = path.join(versionPath, file.folder, file.name);
            } else {
                sourcePath = path.join(versionPath, file.folder, file.name);
                destinationPath = path.join(versionPath, ModsInstallFolder.DISABLED, file.folder, file.name);
            }
            log.info(`Moving file "${sourcePath}" => "${destinationPath}"`);
            await move(sourcePath, destinationPath);
        }
        mod.files = mod.files.filter(file => removeFileIds.findIndex(id => id === file.id) === -1);

        // Delete files
        for (const file of modRef.files.filter(file1 => mod.files.findIndex(file2 => file1.id === file2.id) === -1)) {
            const filepath = file.enabled
                ? path.join(versionPath, file.folder, file.name)
                : path.join(versionPath, ModsInstallFolder.DISABLED, file.folder, file.name);

            log.info(`Deleting file "${filepath}"`);
            await unlink(filepath);
        }

        modRef.files = mod.files;
        await writeFile(modsPath, JSON.stringify(modsConfig));

        log.info(`Updated "${mod.name}"`);

        return mod;
    }
}

const enum ModsInstallFolder {
    PLUGINS = "Plugins",
    LIBS = "Libs",
    IPA = "IPA",
    DISABLED = "Disabled",
    PENDING = "IPA/Pending",
    PLUGINS_PENDING = "IPA/Pending/Plugins",
    LIBS_PENDING = "IPA/Pending/Libs",
    DISABLED_PLUGINS = "Disabled/Plugins",
    DISABLED_LIBS = "Disabled/Libs"
}
