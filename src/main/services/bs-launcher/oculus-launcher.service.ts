import { Observable, ReplaySubject, catchError, lastValueFrom, of, take, timeout } from "rxjs";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, LaunchOption } from "../../../shared/models/bs-launch";
import { OculusService } from "../oculus.service";
import { BS_EXECUTABLE, OCULUS_BS_BACKUP_DIR, OCULUS_BS_DIR } from "../../constants";
import path from "path";
import log from "electron-log";
import { sToMs } from "../../../shared/helpers/time.helpers";
import { lstat, pathExists, readdir, readlink, rename, symlink, unlink } from "fs-extra";
import { AbstractLauncherService } from "./abstract-launcher.service";
import { taskRunning } from "../../helpers/os.helpers";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { InstallationLocationService } from "../installation-location.service";
import { ensurePathNotAlreadyExist } from "../../helpers/fs.helpers";

export class OculusLauncherService extends AbstractLauncherService implements StoreLauncherInterface {

    public static instance: OculusLauncherService;

    public static getInstance(): OculusLauncherService {
        if (!OculusLauncherService.instance) {
            OculusLauncherService.instance = new OculusLauncherService();
        }
        return OculusLauncherService.instance;
    }

    private readonly oculus: OculusService;
    private readonly pathsService: InstallationLocationService;

    private readonly oculusLib$ = new ReplaySubject<string>();

    private constructor() {
        super();
        this.oculus = OculusService.getInstance();
        this.pathsService = InstallationLocationService.getInstance();

        this.oculus.tryGetGameFolder([OCULUS_BS_DIR, OCULUS_BS_BACKUP_DIR]).then(async dirPath => {
            if(dirPath){
                return this.oculusLib$.next( path.join(dirPath, "..") );
            }
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

        const libContents = await readdir(oculusLibPath);
        const symlinks = (await Promise.all(libContents.map(async dir => {
            return (await lstat(path.join(oculusLibPath, dir))).isSymbolicLink() ? dir : null;
        }))).filter(Boolean);

        log.info("Symlinks found in Oculus library", symlinks);

        const bsSymlinks = symlinks.filter(dirent => dirent.startsWith(OCULUS_BS_DIR));

        const bsmSymlinks = (await Promise.all(bsSymlinks.map(async symlink => {
            const symlinkPath = path.join(oculusLibPath, symlink);
            const targetPath = await readlink(symlinkPath).catch(err => log.error(err));

            log.info("Oculus Symlink", symlink, "target", targetPath);

            if(!targetPath){ return null; }

            const bsmVersionsDir = path.join(this.pathsService.INSTALLATION_FOLDER, this.pathsService.VERSIONS_FOLDER);

            if(!targetPath.includes(bsmVersionsDir)){ return null; }

            return symlink;
        }))).filter(Boolean);

        await Promise.all(bsmSymlinks.map(symlink => {
            log.info("Delete symlink", symlink);
            return unlink(path.join(oculusLibPath, symlink));
        }));
    }

    private async backupOriginalBeatSaber(): Promise<void>{
        const bsFolder = await this.oculus.getGameFolder(OCULUS_BS_DIR);
        if(!bsFolder){ return; }
        const backupPath = await ensurePathNotAlreadyExist(path.join(bsFolder, "..", OCULUS_BS_BACKUP_DIR));
        log.info("Backing up original Beat Saber", bsFolder, backupPath);
        return rename(bsFolder, backupPath);
    }

    public async restoreOriginalBeatSaber(): Promise<void>{
        const bsFolderBackupPath = await this.oculus.getGameFolder(OCULUS_BS_BACKUP_DIR);
        if(!(await pathExists(bsFolderBackupPath))){ return; }
        const originalPath = path.join(bsFolderBackupPath, "..", OCULUS_BS_DIR);
        log.info("Restoring original Beat Saber", bsFolderBackupPath, originalPath);
        return rename(bsFolderBackupPath, originalPath);
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData> {

        const prepareOriginalVersion: () => Promise<string> = async () => {
            await this.restoreOriginalBeatSaber();
            const bsPath = await this.oculus.getGameFolder(OCULUS_BS_DIR);
            if(!bsPath){
                throw new Error("Oculus Beat Saber path not found");
            }
            return bsPath;
        }

        const prepareDowngradedVersion: () => Promise<string> = async () => {

            const oculusLib = await lastValueFrom(this.oculusLib$.pipe(take(1), timeout(sToMs(30)), catchError(() => of(null))));

            if(!oculusLib){
                throw CustomError.fromError(new Error("No Oculus library found"), BSLaunchError.OCULUS_LIB_NOT_FOUND);
            }

            // Backup original Beat Saber folder
            await this.backupOriginalBeatSaber();

            // Create symlink in the oculus library from the BSM BS version
            const symlinkTarget = await this.localVersions.getInstalledVersionPath(launchOptions.version);
            const symlinkPath = path.join(oculusLib, OCULUS_BS_DIR);
            log.info("Creating symlink", symlinkTarget, symlinkPath);
            await symlink(symlinkTarget, symlinkPath, "junction");

            return symlinkPath;
        }

        return new Observable<BSLaunchEventData>(obs => {
            (async () => {

                // Cannot start multiple instances of Beat Saber with Oculus
                const bsRunning = await taskRunning(BS_EXECUTABLE).catch(() => false);
                if(bsRunning){
                    throw CustomError.fromError(new Error("Cannot start two instance of Beat Saber for Oculus"), BSLaunchError.BS_ALREADY_RUNNING);
                }

                // Remove previously symlinks created by BSM
                await this.deleteBsSymlinks().catch(err => log.error("Error while deleting BSM symlinks", err));

                const bsPath = await (launchOptions.version.oculus ? prepareOriginalVersion() : prepareDowngradedVersion());

                const exePath = path.join(bsPath, BS_EXECUTABLE);

                if(!(await pathExists(exePath))){
                    throw CustomError.fromError(new Error(`BS Path not exist ${bsPath}`), BSLaunchError.BS_NOT_FOUND);
                }

                // Make sure Oculus is running
                await this.oculus.startOculus().catch(err => log.error("Error while starting Oculus", err));

                obs.next({type: BSLaunchEvent.BS_LAUNCHING});

                // Launch Beat Saber
                return this.launchBs(exePath, this.buildBsLaunchArgs(launchOptions)).catch(err => {
                    throw CustomError.fromError(err, BSLaunchError.BS_EXIT_ERROR);
                });

            })().then(exitCode => {
                log.info("BS process exit code", exitCode);
            }).catch(err => {
                if(err instanceof CustomError){
                    obs.error(err);
                } else {
                    obs.error(CustomError.fromError(err, BSLaunchError.UNKNOWN_ERROR));
                }
            }).finally(() => {
                obs.complete();
            })
        });
    }

}
