import { Observable, ReplaySubject, catchError, lastValueFrom, of, take, timeout } from "rxjs";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { BSLaunchError, BSLaunchErrorData, BSLaunchEventData, LaunchOption } from "../../../shared/models/bs-launch";
import { OculusService } from "../oculus.service";
import { BS_EXECUTABLE, OCULUS_BS_BACKUP_DIR, OCULUS_BS_DIR } from "../../constants";
import path from "path";
import log from "electron-log";
import { sToMs } from "../../../shared/helpers/time.helpers";
import { pathExists, readdir, rename, stat, symlink, unlink } from "fs-extra";
import { AbstractLauncherService } from "./abstract-launcher.service";
import { taskRunning } from "../../helpers/os.helpers";

export class OculusLauncherService extends AbstractLauncherService implements StoreLauncherInterface {

    public static instance: OculusLauncherService;

    public static getInstance(): OculusLauncherService {
        if (!OculusLauncherService.instance) {
            OculusLauncherService.instance = new OculusLauncherService();
        }
        return OculusLauncherService.instance;
    }

    private readonly oculus: OculusService;

    private readonly oculusLib$ = new ReplaySubject<string>();

    private constructor() {
        super();
        this.oculus = OculusService.getInstance();

        this.oculus.tryGetGameFolder([OCULUS_BS_DIR, OCULUS_BS_BACKUP_DIR]).then(async dirPath => {
            if(dirPath){ return this.oculusLib$.next( path.join(dirPath, "..") ); }
            const defaultLib = ((await this.oculus.getOculusLibs()) || []).find(lib => lib.isDefault);
            if(defaultLib?.path){ return this.oculusLib$.next(path.join(defaultLib.path, "Software")); }
            this.oculusLib$.next(null);
        }).catch(err => {
            log.error("Error while getting Oculus libs", err);
            this.oculusLib$.next(null);
        });
    }

    public async deleteBsSymlinks(): Promise<void> {
        const oculusLibPath = await lastValueFrom(this.oculusLib$.pipe(take(1), timeout(sToMs(30)), catchError(() => of(null))));

        if(!oculusLibPath || !(await pathExists(oculusLibPath))){
            throw new Error("Oculus library not found, deleteBsSymlinks"); 
        }

        const libContents = await readdir(oculusLibPath, { withFileTypes: true});
        const symlinks = libContents.filter(dirent => dirent.isSymbolicLink());

        const dirSymlinks = (await Promise.all(symlinks.map(async symlink => {
            const symlinkPath = path.join(oculusLibPath, symlink.name);
            const symlinkStats = await stat(symlinkPath);
            if(!symlinkStats.isDirectory()){ return null; }
            return symlink;
        }))).filter(Boolean);

        const bsSymlinks = dirSymlinks.filter(dirent => dirent.name.startsWith(OCULUS_BS_DIR));
        
        // get only symlinks created by BSM (with metadata.config)
        const bsmSymlinks = (await Promise.all(bsSymlinks.map(async symlink => {
            const symlinkPath = path.join(oculusLibPath, symlink.name);
            const symlinkContents = await readdir(symlinkPath);
            if(!symlinkContents.includes("metadata.config")){
                return null;
            }
            return symlink;
        }))).filter(Boolean);

        await Promise.all(bsmSymlinks.map(symlink => {
            return unlink(path.join(oculusLibPath, symlink.name));
        }));
    }

    private async backupOriginalBeatSaber(): Promise<void>{
        const bsFolder = await this.oculus.getGameFolder(OCULUS_BS_DIR);
        if(!bsFolder){ return; }
        const backupPath = path.join(bsFolder, "..", OCULUS_BS_BACKUP_DIR);
        return rename(bsFolder, backupPath);
    }

    private async restoreOriginalBeatSaber(): Promise<void>{
        const bsFolderBackupPath = await this.oculus.getGameFolder(OCULUS_BS_BACKUP_DIR);
        if(!(await pathExists(bsFolderBackupPath))){ return; }
        const originalPath = path.join(bsFolderBackupPath, "..", OCULUS_BS_DIR);
        return rename(bsFolderBackupPath, originalPath);
    }

    // TODO : Convert all errors to CustomError
    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData> {
        return new Observable<BSLaunchEventData>(obs => {
            (async () => {

                // Cannot start multiple instances of Beat Saber with Oculus
                const bsRunning = await taskRunning(BS_EXECUTABLE);
                if(bsRunning){
                    throw ({type: BSLaunchError.BS_ALREADY_RUNNING, data: bsRunning}) as BSLaunchErrorData;
                }

                const oculusLib = await lastValueFrom(this.oculusLib$.pipe(take(1), timeout(sToMs(30)), catchError(() => of(null))));

                if(!oculusLib){
                    throw new Error("No Oculus library found");
                }

                // Remove previously symlinks created by BSM
                await this.deleteBsSymlinks().catch(log.error);

                // Backup original Beat Saber folder
                await this.backupOriginalBeatSaber();

                // Create symlink in the oculus library from the BSM BS version
                const symlinkTarget = await this.localVersions.getInstalledVersionPath(launchOptions.version);
                const symlinkPath = path.join(oculusLib, OCULUS_BS_DIR);
                await symlink(symlinkTarget, symlinkPath, "junction");

                // Launch Beat Saber
                const exePath = path.join(symlinkPath, "Beat Saber.exe");
                return this.launchBs(exePath, this.buildBsLaunchArgs(launchOptions)).catch(err => {
                    throw ({type: BSLaunchError.BS_EXIT_ERROR, data: err}) as BSLaunchErrorData;
                });

            })().catch(err => {
                obs.error(err);
            }).finally(() => {
                obs.complete();
            })
        });
    }

}