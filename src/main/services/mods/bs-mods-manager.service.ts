import { BSVersion } from "shared/bs-version.interface";
import { DownloadLink, Mod } from "shared/models/mods";
import { BeatModsApiService } from "./beat-mods-api.service";
import { BSLocalVersionService } from "../bs-local-version.service";
import path from "path";
import md5File from "md5-file";
import { RequestService } from "../request.service";
import { spawn } from "child_process";
import { BS_EXECUTABLE } from "../../constants";
import log from "electron-log";
import { deleteFolder, ensureFolderExist, pathExist, Progression, unlinkPath } from "../../helpers/fs.helpers";
import { lastValueFrom, Observable } from "rxjs";
import recursiveReadDir from "recursive-readdir";
import { sToMs } from "../../../shared/helpers/time.helpers";
import { pathExistsSync, unlinkSync } from "fs-extra";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { popElement } from "shared/helpers/array.helpers";
import { LinuxService } from "../linux.service";
import { tryit } from "shared/helpers/error.helpers";
import { UtilsService } from "../utils.service";
import crypto from "crypto";
import { YauzlZip } from "main/models/yauzl-zip.class";

export class BsModsManagerService {
    private static instance: BsModsManagerService;

    private readonly beatModsApi: BeatModsApiService;
    private readonly bsLocalService: BSLocalVersionService;
    private readonly linuxService: LinuxService;
    private readonly requestService: RequestService;
    private readonly utilsService: UtilsService;

    private manifestMatches: Mod[];

    public static getInstance(): BsModsManagerService {
        if (!BsModsManagerService.instance) {
            BsModsManagerService.instance = new BsModsManagerService();
        }
        return BsModsManagerService.instance;
    }

    private constructor() {
        this.beatModsApi = BeatModsApiService.getInstance();
        this.bsLocalService = BSLocalVersionService.getInstance();
        this.linuxService = LinuxService.getInstance();
        this.requestService = RequestService.getInstance();
        this.utilsService = UtilsService.getInstance();
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

    private async downloadZip(zipUrl: string): Promise<string> {
        zipUrl = path.join(this.beatModsApi.BEAT_MODS_URL, zipUrl);

        log.info("Download mod zip", zipUrl);

        const fileName = `${path.basename(zipUrl, ".zip")}-${crypto.randomUUID()}.zip`;
        const tempPath = this.utilsService.getTempPath();
        const destination = path.join(tempPath, fileName);

        try {
            await ensureFolderExist(tempPath);
            return (await lastValueFrom(this.requestService.downloadFile(zipUrl, destination))).data;
        } catch (error) {
            log.error("Could not download zip file at", zipUrl);
            return null;
        }
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

        let cmd = `"${ipaPath}" "${bsExePath}" ${args.join(" ")}`;
        if (process.platform === "linux") {
            const { error, result: winePath } = tryit(() => this.linuxService.getWinePath());
            if (error) {
                log.error(error);
                return false;
            }
            cmd = `"${winePath}" ${cmd}`;
        }

        return new Promise<boolean>(resolve => {
            log.info("START IPA PROCESS", cmd);
            const processIPA = spawn(cmd, { cwd: versionPath, detached: true, shell: true });

            const timeout = setTimeout(() => {
                log.info("Ipa process timeout");
                resolve(false)
            }, sToMs(30));

            processIPA.stdout.on("data", data => {
                log.info("IPA process stdout", data.toString());
            });
            processIPA.stderr.on("data", data => {
                log.error("IPA process stderr", data.toString());
            })

            processIPA.once("exit", code => {
                clearTimeout(timeout);
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

        const download = this.getModDownload(mod, version);

        if (!download) {
            return false;
        }

        log.info("Start download mod zip", mod.name, download.url);
        const zipPath = await this.downloadZip(download.url);
        log.info("Mod zip download end", mod.name, download.url, !!zipPath);
        if (!zipPath) {
            return false;
        }

        const zip = await YauzlZip.fromPath(zipPath);
        let hashCount = 0;
        for await (const entry of zip.entries()) {
            const buffer = await entry.read();
            const md5Hash = crypto.createHash("md5")
                .update(buffer)
                .digest("hex");
            hashCount += +download.hashMd5.some(md5 => md5.hash === md5Hash);
        }

        if (hashCount !== download.hashMd5.length) {
            return false;
        }

        const versionPath = await this.bsLocalService.getVersionPath(version);
        const isBSIPA = mod.name.toLowerCase() === "bsipa";
        const destDir = isBSIPA ? versionPath : path.join(versionPath, ModsInstallFolder.PENDING);

        log.info("Start extracting mod zip", mod.name, "to", destDir);
        const extracted = await zip.extract(destDir)
            .then(() => true)
            .catch(e => {
                log.error("Error while extracting mod zip", e);
                return false;
            })
            .finally(() => {
                zip.close();
                if (pathExistsSync(zipPath)) {
                    unlinkSync(zipPath);
                }
            });

        log.info("Mod zip extraction end", mod.name, "to", destDir, "success:", extracted);

        const res = isBSIPA
            ? extracted &&
              (await this.executeBSIPA(version, ["-n"]).catch(e => {
                  log.error(e);
                  return false;
              }))
            : extracted;

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

    public installMods(mods: Mod[], version: BSVersion): Observable<Progression> {
        const progress = { current: 0, total: mods.length };

        return new Observable<Progression>(obs => {
            (async () => {
                if (!mods?.length) {
                    throw CustomError.throw(new Error("No mods to install"), "no-mods", mods);
                }

                obs.next(progress);

                const bsipa = popElement(mod => mod.name.toLowerCase() === "bsipa", mods);

                if(bsipa){
                    const bsipaInstalled = await this.installMod(bsipa, version).catch(err => {
                        log.error("Error while installing BSIPA", err);
                    });

                    if(!bsipaInstalled){
                        throw CustomError.throw(new Error("BSIPA failed to install"), "cannot-install-bsipa");
                    }

                    progress.current++;
                    obs.next(progress);
                }

                for (const mod of mods) {
                    await this.installMod(mod, version);
                    progress.current++;
                    obs.next(progress);
                }
            })()
            .catch(err => obs.error(err))
            .finally(() => obs.complete());
        });
    }

    public uninstallMods(mods: Mod[], version: BSVersion): Observable<Progression> {
        const progress = { current: 0, total: mods.length };

        return new Observable<Progression>(obs => {
            (async () => {
                if (!mods?.length) {
                    throw CustomError.throw(new Error("No mods to uninstall"), "no-mods", mods);
                }

                obs.next(progress);

                for (const mod of mods) {
                    await this.uninstallMod(mod, version);
                    progress.current++;
                    obs.next(progress);
                }
            })()
            .catch(err => obs.error(err))
            .finally(() => obs.complete());
        });
    }

    public uninstallAllMods(version: BSVersion): Observable<Progression> {
        return new Observable<Progression>(obs => {
            (async () => {
                const mods = await this.getInstalledMods(version).catch(err => {
                    log.error(err);
                    return [];
                });

                const progress = { current: 0, total: mods.length };

                obs.next(progress);

                for (const mod of mods) {
                    await this.uninstallMod(mod, version);
                    progress.current++;
                    obs.next(progress);
                }

                const versionPath = await this.bsLocalService.getVersionPath(version);

                await deleteFolder(path.join(versionPath, ModsInstallFolder.PLUGINS));
                await deleteFolder(path.join(versionPath, ModsInstallFolder.LIBS));
                await deleteFolder(path.join(versionPath, ModsInstallFolder.IPA));
            })()
            .catch(err => obs.error(err))
            .finally(() => obs.complete());
        });
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
