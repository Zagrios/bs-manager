import { BSVersionLibService } from "./bs-version-lib.service";
import { BSVersion, BSVersionMetadata } from "shared/bs-version.interface";
import { InstallationLocationService } from "./installation-location.service";
import { SteamService } from "./steam.service";
import { BS_APP_ID, OCULUS_BS_BACKUP_DIR, OCULUS_BS_DIR } from "../constants";
import path from "path";
import { ConfigurationService } from "./configuration.service";
import { lstat, rename } from "fs/promises";
import { BsmException } from "shared/models/bsm-exception.model";
import log from "electron-log";
import { OculusService } from "./oculus.service";
import { DownloadLinkType } from "shared/models/mods";
import sanitize from "sanitize-filename";
import { Progression, copyDirectoryWithJunctions, deleteFolder, ensurePathNotAlreadyExist, getFoldersInFolder, rxCopy } from "../helpers/fs.helpers";
import { FolderLinkerService } from "./folder-linker.service";
import { ReadStream, createReadStream, pathExists, readFile, writeFile } from "fs-extra";
import readline from "readline";
import { Observable, Subject, catchError, finalize, from, map, switchMap, throwError } from "rxjs";
import { BsStore } from "../../shared/models/bs-store.enum";
import { CustomError } from "../../shared/models/exceptions/custom-error.class";
import crypto from "crypto";


export class BSLocalVersionService {
    private static instance: BSLocalVersionService;

    private readonly CUSTOM_VERSIONS_KEY = "custom-versions";
    private readonly METADATA_FILE = "metadata.config";

    private readonly installLocationService: InstallationLocationService;
    private readonly steamService: SteamService;
    private readonly oculusService: OculusService;
    private readonly remoteVersionService: BSVersionLibService;
    private readonly configService: ConfigurationService;
    private readonly linker: FolderLinkerService;
    private readonly _loadedVersions$: Subject<BSVersion[]>;

    public static getInstance(): BSLocalVersionService {
        if (!BSLocalVersionService.instance) {
            BSLocalVersionService.instance = new BSLocalVersionService();
        }
        return BSLocalVersionService.instance;
    }

    private constructor() {
        this.installLocationService = InstallationLocationService.getInstance();
        this.steamService = SteamService.getInstance();
        this.oculusService = OculusService.getInstance();
        this.remoteVersionService = BSVersionLibService.getInstance();
        this.configService = ConfigurationService.getInstance();
        this.linker = FolderLinkerService.getInstance();

        this._loadedVersions$ = new Subject<BSVersion[]>();
    }

    private async getVersionFromGlobalGameManagerFile(versionFilePath: string): Promise<BSVersion> {

        if(!(await pathExists(versionFilePath))){
            log.info("globalgamemanagers file not found", versionFilePath);
            return null;
        }

        const versionsDict = await this.remoteVersionService.getAvailableVersions();

        let stream: ReadStream;

        try{
            stream = createReadStream(versionFilePath);
            const rl = readline.createInterface({
                input: stream,
                crlfDelay: Infinity
            });

            for await (const line of rl) {
                for (const bsVersion of versionsDict) {
                    if (line.includes(bsVersion.BSVersion)) {
                        stream.close();
                        return {...bsVersion};
                    }
                }
            }

        } catch(e) {
            log.error(e);
        } finally {
            stream?.close();
        }

        log.info("unable to get version from globalgamemanagers file", versionFilePath);

        return null;
    }

    public async getVersionOfBSFolder(
        bsPath: string,
        options?: {
            steam?: boolean;
            oculus?: boolean;
        }
    ): Promise<BSVersion>{

        log.info("getVersionOfBSFolder", bsPath, options);

        if(!bsPath){ return null; }

        const versionFilePath = path.join(bsPath, 'Beat Saber_Data', 'globalgamemanagers');
        const folderVersion = await this.getVersionFromGlobalGameManagerFile(versionFilePath);

        if(!folderVersion){ return null; }

        if(options?.steam || options?.oculus){
            return {...folderVersion, ...options};
        }

        if(folderVersion.BSVersion !== path.basename(bsPath)){
            folderVersion.name = path.basename(bsPath);
        }

        const folderStats = await lstat(bsPath);
        if(folderStats.ino){
            folderVersion.ino = folderStats.ino;
        }


        let metadata = await this.getAllVersionMetadata(folderVersion);

        // Will be removed in future version. It just to prepare future features
        if(!metadata?.id){
            metadata = await this.initVersionMetadata(folderVersion, metadata ?? { store: BsStore.STEAM });
        }
        folderVersion.metadata = metadata;

        const customVersion = this.getCustomVersions().find(customVersion => {
            return customVersion.BSVersion === folderVersion.BSVersion && customVersion.name === folderVersion.name;
        });

        folderVersion.color = customVersion?.color;

        return folderVersion;
    }

    private async writeVersionMetadata(version: BSVersion, metadata: BSVersionMetadata): Promise<void>{
        const versionPath = await this.getVersionPath(version);
        const metadataPath = path.join(versionPath, this.METADATA_FILE);
        return writeFile(metadataPath, JSON.stringify(metadata));
    }

    public initVersionMetadata(version: BSVersion, metadata: Omit<BSVersionMetadata, "id">): Promise<BSVersionMetadata>{
        const firstMetadata = { id: crypto.randomUUID(), ...metadata };
        return this.writeVersionMetadata(version, firstMetadata).then(() => firstMetadata).catch(err => {
            log.error("initVersionMetadata error", err);
            return firstMetadata;
        });
    }

    public getAllVersionMetadata(version: BSVersion): Promise<BSVersionMetadata>{
        return (async () => {
            const versionPath = await this.getVersionPath(version);
            const contents = await readFile(path.join(versionPath, this.METADATA_FILE), "utf-8");
            return JSON.parse(contents);
        })().catch(e => {
            log.warn("Error getAllVersionMetadata", e);
        });
    }

    private setCustomVersions(versions: BSVersion[]): void{
        this.configService.set(this.CUSTOM_VERSIONS_KEY, versions);
    }

    private addCustomVersion(version: BSVersion): void{
        this.setCustomVersions([...this.getCustomVersions() ?? [], version]);
    }

    private getCustomVersions(): BSVersion[]{
        return this.configService.get<BSVersion[]>(this.CUSTOM_VERSIONS_KEY) || [];
    }

    private deleteCustomVersion(version: BSVersion): void{
        const customVersions = this.getCustomVersions() || [];
        this.setCustomVersions(customVersions.filter(v => (v.name !== version.name || v.BSVersion !== version.BSVersion || v.color !== version.color)));
    }


    /**
     * Return path of a version even if it's not installed.
     * @param {BSVersion} version
     * @returns {Promise<string>}
     */
    public async getVersionPath(version: BSVersion): Promise<string>{
        if(version.steam){ return this.steamService.getGameFolder(BS_APP_ID, "Beat Saber") }
        if(version.oculus){ return this.oculusService.tryGetGameFolder([OCULUS_BS_DIR, OCULUS_BS_BACKUP_DIR]); }

        return path.join(
            this.installLocationService.versionsDirectory(),
            this.getVersionFolder(version)
        );
    }

    /**
     * Return path of an installed version. Returns null if not found.
     * @param {BSVersion} version
     * @returns {Promise<string>}
     */
    public async getInstalledVersionPath(version: BSVersion): Promise<string>{
        const versionPath = await this.getVersionPath(version);
        if(await pathExists(versionPath)){ return versionPath; }

        const versionFolders = await getFoldersInFolder(this.installLocationService.versionsDirectory());

        for(const folder of versionFolders){
            const stats = await lstat(folder);
            if(stats.ino === version.ino){
                return folder;
            }
        }

        return null;
    }

    public getVersionFolder(version: BSVersion): string{
        return version.name ?? version.BSVersion;
    }

    public getVersionType(version: BSVersion): DownloadLinkType {
        if (version.steam) {
            return "steam";
        }
        if (version.oculus) {
            return "oculus";
        }
        return "universal";
    }

    private async getSteamVersion(): Promise<BSVersion> {
        const steamBsFolder = await this.steamService.getGameFolder(BS_APP_ID, "Beat Saber");

        if (!steamBsFolder || !(await pathExists(steamBsFolder))) {
            return null;
        }

        return this.getVersionOfBSFolder(steamBsFolder, { steam: true });
    }

    private async getOculusVersion(): Promise<BSVersion> {
        const oculusBsFolder = await this.oculusService.tryGetGameFolder([OCULUS_BS_DIR, OCULUS_BS_BACKUP_DIR]);

        if (!oculusBsFolder) {
            return null;
        }

        return this.getVersionOfBSFolder(oculusBsFolder, { oculus: true });
    }

    public async getInstalledVersions(): Promise<BSVersion[]> {
        const versions: BSVersion[] = [];

        const steamVersion = await this.getSteamVersion().catch(e => {
            log.error("unable to get original Steam version", e);
        });

        if (steamVersion) {
            versions.push(steamVersion);
        }

        const oculusVersion = await this.getOculusVersion().catch(e => {
            log.error("unable to get original Oculus version", e);
        });

        if (oculusVersion) {
            versions.push(oculusVersion);
        }

        if (!(await pathExists(this.installLocationService.versionsDirectory()))) {
            return versions;
        }

        const folderInInstallation = await getFoldersInFolder(this.installLocationService.versionsDirectory());

        log.info("Finded versions folders", folderInInstallation);

        for (const f of folderInInstallation) {

            const version = await this.getVersionOfBSFolder(f).catch(e => {
                log.error("unable to get version of folder", f, e);
            });

            if(!version){ continue; }

            versions.push(version);
        };

        this.setCustomVersions(versions.filter(v => !!v.color));

        this._loadedVersions$.next(versions);

        return versions;
    }

    public async deleteVersion(version: BSVersion): Promise<boolean>{
        if(version.steam || version.oculus){ return false; }
        const versionFolder = await this.getVersionPath(version);
        if(!(await pathExists(versionFolder))){ return true; }

        return deleteFolder(versionFolder)
            .then(() => { return true; })
            .catch(() => { return false; })
    }

   public async editVersion(version: BSVersion, name: string, color: string): Promise<BSVersion>{
      if(version.steam || version.oculus){ throw {title: "CantEditSteam", message: "CantEditSteam"} as BsmException; }
      const oldPath = await this.getVersionPath(version);
      const editedVersion: BSVersion = version.BSVersion === name
         ? {...version, name: undefined, color}
         : {...version, name: sanitize(name), color};
      const newPath = await this.getVersionPath(editedVersion);

      if(oldPath === newPath){
         this.deleteCustomVersion(version);
         this.addCustomVersion(editedVersion);
         return editedVersion;
      }

      if((await pathExists(newPath)) && newPath === oldPath){ throw {title: "VersionAlreadExist"} as BsmException; }

      return rename(oldPath, newPath).then(() => {
         this.deleteCustomVersion(version);
         this.addCustomVersion(editedVersion);
         return editedVersion;
      }).catch((err: Error) => {
         log.error("edit version error", err, version, name, color);
         throw {title: "CantRename", ...err} as BsmException;
      });
   }

   public async cloneVersion(version: BSVersion, name: string, color: string): Promise<BSVersion>{
      const originPath = await this.getVersionPath(version);
      const cloneVersion: BSVersion = version.BSVersion === name
         ? {...version, name: undefined, color, steam: false, oculus: false}
         : {...version, name: sanitize(name), color, steam: false, oculus: false};
      const newPath = await this.getVersionPath(cloneVersion);

      if(originPath === newPath){
         this.deleteCustomVersion(version);
         this.addCustomVersion(cloneVersion);
      }

      if(await pathExists(newPath)){ throw {title: "VersionAlreadExist"} as BsmException; }

      return copyDirectoryWithJunctions(originPath, newPath).then(() => {
         this.addCustomVersion(cloneVersion);
         return cloneVersion;
      }).catch((err: Error) => {
         log.error("clone version error", err, version, name, color);
         throw {title: "CantClone", ...err} as BsmException
      })
   }

    public importVersion(opt: ImportVersionOptions): Observable<Progression<BSVersion>>{
        const { fromPath, store } = opt;

        let failed = false;
        let versionDest:  {version: BSVersion, dest: string} = null;

        return from(this.getVersionOfBSFolder(fromPath)).pipe(
            map(version => version || CustomError.throw(new Error("Unable to get BS version of path"), "NOT_BS_FOLDER")),
            switchMap(version => this.getVersionPath(version).then(dest => ({version, dest}))),
            switchMap(({version, dest}) => ensurePathNotAlreadyExist(dest).then(uniquePath => {
                const res = dest === uniquePath ? {version, dest} : {version: {...version, name: path.basename(uniquePath)}, dest: uniquePath} as {version: BSVersion, dest: string};
                versionDest = res;
                return res;
            })),
            switchMap(({version, dest}) => rxCopy(fromPath, dest, { dereference: true }).pipe(
                map(progress => ({...progress, data: version}))
            )),
            catchError(err => {
                failed = true;
                return throwError(() => err);
            }),
            finalize(async () => {
                if(failed){ return; }
                await this.initVersionMetadata(versionDest.version, { store });
            })
        );
    }

    public async getLinkedFolders(version: BSVersion): Promise<string[]>{
        const versionPath = await this.getVersionPath(version);
        const [rootFolders, beatSaberDataFolders] = await Promise.all([getFoldersInFolder(versionPath), getFoldersInFolder(path.join(versionPath, "Beat Saber_Data"))]);

        const linkedFolder = Promise.all(
            [...rootFolders, ...beatSaberDataFolders].map(async folder => {
                if (!(await this.linker.isFolderSymlink(folder))) {
                    return null;
                }
                return folder;
            })
        );

        return (await linkedFolder).filter(folder => folder);
    }

    public get loadedVersions$(): Observable<BSVersion[]>{
        return this._loadedVersions$.asObservable();
    }
}

export interface ImportVersionOptions {
    fromPath: string;
    store: BsStore
}
