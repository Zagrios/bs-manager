import { BSVersion } from "shared/bs-version.interface";
import { BeatModsApiService } from "./beat-mods-api.service";
import { BSLocalVersionService } from "../bs-local-version.service";
import path from "path";
import md5File from "md5-file";
import { RequestService } from "../request.service";
import { BS_EXECUTABLE } from "../../constants";
import log from "electron-log";
import { deleteFile, deleteFolder, pathExist, Progression } from "../../helpers/fs.helpers";
import { lastValueFrom, Observable } from "rxjs";
import recursiveReadDir from "recursive-readdir";
import { sToMs } from "../../../shared/helpers/time.helpers";
import { copyFile, ensureDir, pathExistsSync, readdirSync } from "fs-extra";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { popElement } from "shared/helpers/array.helpers";
import { LinuxService } from "../linux.service";
import { tryit } from "shared/helpers/error.helpers";
import crypto from "crypto";
import { BsmZipExtractor } from "main/models/bsm-zip-extractor.class";
import { BsmShellLog, bsmSpawn } from "main/helpers/os.helpers";
import { BbmFullMod, BbmModVersion, ExternalMod } from "../../../shared/models/mods/mod.interface";

export class BsModsManagerService {
    private static instance: BsModsManagerService;

    private readonly beatModsApi: BeatModsApiService;
    private readonly bsLocalService: BSLocalVersionService;
    private readonly linuxService: LinuxService;
    private readonly requestService: RequestService;

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
    }

    private async getModFromHash(hash: string): Promise<BbmModVersion | undefined> {
        const mod: BbmModVersion | undefined = await this.beatModsApi.getModByHash(hash)
            .catch((error): undefined => {
                log.warn("Could not get mod with hash", hash, "cause", error?.message);
                return undefined;
            });

        if(mod?.contentHashes?.some(content => content.path.includes("IPA.exe"))){
            return undefined;
        }

        return mod;

    }

    private async getModsInDir(
        version: BSVersion,
        modsDir: ModsInstallFolder,
        manifestMatches: BbmModVersion[]
    ): Promise<BbmModVersion[]> {
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

            log.info("Getting mod manifest", filePath);
            const hash = await md5File(filePath);
            const mod = await this.getModFromHash(hash);

            if (!mod) {
                return undefined;
            }

            if (ext === ".manifest") {
                manifestMatches.push(mod);
                return undefined;
            }

            if (modsDir === ModsInstallFolder.LIBS || modsDir === ModsInstallFolder.LIBS_PENDING) {
                const manifestIndex = manifestMatches.findIndex(m => m.id === mod.id);
                if (manifestIndex < 0) {
                    log.warn("No matching manifest for", `"${filePath}"`, "with hash:", hash);
                    return undefined;
                }

                manifestMatches.splice(manifestIndex, 1);
            }

            return mod;
        });

        const results = await Promise.allSettled(promises);

        return results.reduce((mods, mod) => {
            if (mod?.status === "fulfilled" && mod?.value) {
                mods.push(mod.value);
            } else if (mod?.status === "rejected") {
                log.error("MOD FAILED", mod);
            }
            return mods;
        }, [] as BbmModVersion[]);
    }

    private async getBsipaInstalled(version: BSVersion): Promise<BbmModVersion> {
        const bsPath = await this.bsLocalService.getVersionPath(version);
        const injectorPath = path.join(bsPath, "Beat Saber_Data", "Managed", "IPA.Injector.dll");
        if (!(await pathExist(injectorPath))) {
            return undefined;
        }
        const injectorMd5 = await md5File(injectorPath);
        return this.beatModsApi.getModByHash(injectorMd5).catch((error): undefined => {
            log.error("Could not get bsipa mod", error?.message);
            return undefined;
        });
    }

    private async downloadZip(zipUrl: string): Promise<BsmZipExtractor> {
        zipUrl = new URL(zipUrl, this.beatModsApi.MODS_REPO_URL).href;

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

        const env: Record<string, string> = {};
        const cmd = `"${ipaPath}" "${bsExePath}" ${args.join(" ")}`;
        let winePath: string = "";
        if (process.platform === "linux") {
            const { error: winePathError, result: winePathResult } =
                await tryit(async () => this.linuxService.getWinePath());
            if (winePathError) {
                log.error(winePathError);
                return false;
            }
            winePath = `"${winePathResult}"`;

            const winePrefix = this.linuxService.getWinePrefixPath();
            if (!winePrefix) {
                throw new CustomError("Could not find BSManager WINEPREFIX path", "no-wineprefix");
            }
            env.WINEPREFIX = winePrefix;
        }

        return new Promise<boolean>(resolve => {
            const processIPA = bsmSpawn(cmd, {
                log: BsmShellLog.Command | BsmShellLog.EnvVariables,
                options: {
                    cwd: versionPath,
                    detached: true,
                    shell: true,
                    env
                },
                linux: { prefix: winePath },
            });

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

    private getModDownload(modVersion: BbmModVersion): string {
        return `/cdn/mod/${modVersion.zipHash}.zip`
    }

    private async installMod(mod: BbmFullMod, version: BSVersion): Promise<boolean> {
        log.info("INSTALL MOD", mod.mod.name, "for version", `${version.BSVersion} - ${version.name}`);

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

        return res;
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

            const res = await tryit(() => content.isDirectory()
                ? deleteFolder(contentPath)
                : deleteFile(contentPath)
            );

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
            return deleteFile(path.join(verionPath, file));
        });

        await Promise.all(promises);
    }
    private async uninstallMod(mod: BbmFullMod, version: BSVersion): Promise<void> {
        if (mod.mod.name.toLowerCase() === "bsipa") {
            return this.uninstallBSIPA(mod, version);
        }

        const versionPath = await this.bsLocalService.getVersionPath(version);

        const promises: Promise<void>[] = mod.version.contentHashes.map(async content => {
            return (async () => {
                const modPath = path.join(versionPath, content.path);
                if(pathExistsSync(modPath)){
                    log.info("Deleting mod", modPath);
                    await deleteFile(modPath);
                }

                const pendingPath = path.join(versionPath, "IPA", "Pending", content.path);
                if(pathExistsSync(pendingPath)){
                    log.info("Deleting pending mod", pendingPath);
                    return deleteFile(pendingPath);
                }

                log.warn("Mod file not found in", versionPath, "or pending folder", pendingPath);
            })() ;
        });

        await Promise.all(promises);
    }

    public async getAvailableMods(version: BSVersion): Promise<BbmFullMod[]> {
        return this.beatModsApi.getVersionMods(version).catch(() => {
            return [] as BbmFullMod[];
        });
    }

    public async getInstalledMods(version: BSVersion): Promise<BbmModVersion[]> {
        const bsipa = await this.getBsipaInstalled(version);

        const manifestMatches: BbmModVersion[] = [];
        const pluginsMods = await Promise.all([
            this.getModsInDir(version, ModsInstallFolder.PLUGINS_PENDING, manifestMatches),
            this.getModsInDir(version, ModsInstallFolder.PLUGINS, manifestMatches)
        ]);
        const libsMods = await Promise.all([
            this.getModsInDir(version, ModsInstallFolder.LIBS_PENDING, manifestMatches),
            this.getModsInDir(version, ModsInstallFolder.LIBS, manifestMatches)
        ]);

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

    public async isModded(version: BSVersion): Promise<boolean> {
        return Boolean(await this.getBsipaInstalled(version));
    }

    private async importMod(modPath: string, destination: string): Promise<string[]> {
        const extensionName = path.extname(modPath).toLowerCase();

        if (extensionName === ".dll") {
            const filename = path.basename(modPath);
            // Defaultly copy the ".dll" to the "IPA/Pending/Plugins" folder
            const fileFolder = path.join(destination, ModsInstallFolder.PLUGINS);

            log.info("Copying", `${modPath}`, "to", `"${fileFolder}"`);
            await ensureDir(fileFolder);
            const copied = await copyFile(modPath, path.join(fileFolder, filename))
                .then(() => true)
                .catch(error => {
                    log.warn("Could not copy", `"${modPath}"`, error);
                    return false;
                });
            return copied ? [ filename ] : [];
        }

        if (extensionName !== ".zip") {
            log.warn("Mod file is not a dll or zip file");
            return [];
        }

        log.info("Extracting", `"${modPath}"`, "to", `"${destination}"`);
        const zip = await BsmZipExtractor.fromPath(modPath);

        try {
            const dll = await zip.findEntry(entry => entry.fileName.endsWith(".dll"));

            if (!dll) {
                log.warn("No \"dll\" found in zip", modPath);
                return [];
            }

            return await zip.extract(destination);
        } catch (error) {
            log.warn("Could not extract", `"${modPath}"`, error);
            return [];
        } finally {
            zip.close();
        }
    }

    public importMods(paths: string[], version: BSVersion): Observable<Progression<ExternalMod>> {
        return new Observable<Progression<ExternalMod>>(obs => {
            const progress: Progression<ExternalMod> = { total: 0, current: 0 };
            const externalMod: ExternalMod = {
                name: "",
                files: [],
            };
            let modsInstalledCount = 0;
            let modFilesCount = 0;
            const abortController = new AbortController();

            (async () => {
                const versionPath = await this.bsLocalService.getVersionPath(version);
                const modsPendingFolder = path.join(versionPath, ModsInstallFolder.PENDING);

                for (const modPath of paths) {
                    if (abortController.signal?.aborted) {
                        log.info("Mods import has been cancelled");
                        return;
                    }

                    progress.total = paths.length;
                    obs.next(progress);

                    if (!pathExistsSync(modPath)) { continue; }

                    const modFiles = await this.importMod(modPath, modsPendingFolder);
                    if (modFiles.length > 0) {
                        ++modsInstalledCount;
                        modFilesCount += modFiles.length;

                        externalMod.name = path.basename(modPath, path.extname(modPath));
                        externalMod.files = modFiles;
                        progress.data = externalMod;
                    } else {
                        progress.data = undefined;
                    }
                    ++progress.current;
                    obs.next(progress);
                }
            })()
              .then(() => {
                  if (modsInstalledCount === 0) {
                      throw new CustomError("No \"dll\" found in any of the files dropped", "no-dlls");
                  }
                  log.info("Successfully imported", modsInstalledCount, "mods from", paths.length, "files paths. Total files/folders added", modFilesCount);
              })
              .catch(error => {
                  obs.error(error);
              })
              .finally(() => obs.complete());

            return () => {
                abortController.abort();
            }
        });
    }

    public installMods(mods: BbmFullMod[], version: BSVersion): Observable<Progression> {
        const progress = { current: 0, total: mods.length };

        return new Observable<Progression>(obs => {
            (async () => {
                if (!mods?.length) {
                    throw CustomError.throw(new Error("No mods to install"), "no-mods", mods);
                }

                obs.next(progress);

                const bsipa = popElement(mod => mod.mod.name.toLowerCase() === "bsipa", mods);

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

    public uninstallMods(mods: BbmFullMod[], version: BSVersion): Observable<Progression> {
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

                const versionMods = await this.getAvailableMods(version);
                const installedMods = await this.getInstalledMods(version);

                const fullInstalledMods = (installedMods || []).reduce((mods, version) => {
                    const mod = versionMods.find(mod => version.modId === mod.mod.id)?.mod;
                    if (mod) { mods.push({ version, mod }); }
                    return mods;
                }, [] as BbmFullMod[]);

                const progress = { current: 0, total: fullInstalledMods.length };

                obs.next(progress);

                for (const mod of fullInstalledMods) {
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
