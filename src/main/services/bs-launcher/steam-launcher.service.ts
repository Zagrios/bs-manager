import { Observable } from "rxjs";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, BSLaunchWarning, LaunchOption } from "../../../shared/models/bs-launch";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { pathExists, rename } from "fs-extra";
import { SteamService } from "../steam.service";
import path from "path";
import { BS_APP_ID, BS_EXECUTABLE, STEAMVR_APP_ID } from "../../constants";
import log from "electron-log";
import { AbstractLauncherService } from "./abstract-launcher.service";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { UtilsService } from "../utils.service";
import { exec } from "child_process";
import fs from 'fs';

export class SteamLauncherService extends AbstractLauncherService implements StoreLauncherInterface{

    private static instance: SteamLauncherService;

    public static getInstance(): SteamLauncherService{
        if(!SteamLauncherService.instance){
            SteamLauncherService.instance = new SteamLauncherService();
        }
        return SteamLauncherService.instance;
    }

    private readonly steam: SteamService;
    private readonly util: UtilsService;

    private constructor(){
        super();
        this.steam = SteamService.getInstance();
        this.util = UtilsService.getInstance();
    }

    private getSteamVRPath(): Promise<string> {
        return this.steam.getGameFolder(STEAMVR_APP_ID, "SteamVR");
    }

    private async backupSteamVR(): Promise<void> {
        const steamVrFolder = await this.getSteamVRPath();
        if (!(await pathExists(steamVrFolder))) {
            return;
        }
        return rename(steamVrFolder, `${steamVrFolder}.bak`).catch(err => {
            log.error("Error while create backup of SteamVR", err);
        });
    }

    private getStartBsAsAdminExePath(): string {
        return path.join(this.util.getAssetsScriptsPath(), "start_beat_saber_admin.exe");
    }

    public async restoreSteamVR(): Promise<void> {
        const steamVrFolder = await this.getSteamVRPath();
        const steamVrBackup = `${steamVrFolder}.bak`;

        if (!(await pathExists(steamVrBackup))) {
            return;
        }

        return rename(steamVrBackup, steamVrFolder).catch(err => {
            log.error("Error while restoring SteamVR", err);
        });
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{

        return new Observable<BSLaunchEventData>(obs => {(async () => {

            const bsFolderPath = await this.localVersions.getInstalledVersionPath(launchOptions.version);
            let exePath = path.join(bsFolderPath, BS_EXECUTABLE);

            if(!(await pathExists(exePath))){
                throw CustomError.fromError(new Error(`Path not exist : ${exePath}`), BSLaunchError.BS_NOT_FOUND);
            }

            // Open Steam if not running
            if(!(await this.steam.steamRunning())){
                obs.next({type: BSLaunchEvent.STEAM_LAUNCHING});

                await this.steam.openSteam().then(() => {
                    obs.next({type: BSLaunchEvent.STEAM_LAUNCHED});
                }).catch(e => {
                    log.error(e);
                    obs.next({type: BSLaunchWarning.UNABLE_TO_LAUNCH_STEAM});
                });
            }

            // Backup SteamVR when desktop mode is enabled
            if(launchOptions.desktop){
                await this.backupSteamVR().catch(() => {
                    return this.restoreSteamVR();
                });
            } else {
                await this.restoreSteamVR().catch(log.error);
            }

            let launchArgs = this.buildBsLaunchArgs(launchOptions);
            const steamPath = await this.steam.getSteamPath();

            const env = {
                ...process.env,
                "SteamAppId": BS_APP_ID,
                "SteamOverlayGameId": BS_APP_ID,
                "SteamGameId": BS_APP_ID,
            };

            // Linux setup
            if (process.platform === "linux") {
                if (launchOptions.admin) {
                    log.warn("Launching as admin is not supported on Linux! Starting the game as a normal user.");
                    launchOptions.admin = false;
                }

                // Create the compat data path if it doesn't exist.
                // If the user never ran Beat Saber through steam before
                // using bsmanager, it won't exist, and proton will fail
                // to launch the game.
                const compatDataPath = `${steamPath}/steamapps/compatdata/${BS_APP_ID}`;
                if (!fs.existsSync(compatDataPath)) {
                    log.info(`Proton compat data path not found at '${compatDataPath}', creating directory`);
                    fs.mkdirSync(compatDataPath);
                }

                // proton run BeatSaber.exe
                launchArgs = [
                    "run",
                    `${exePath}`,
                    ...launchArgs,
                ];
                exePath = launchOptions.protonPath;
                if (!exePath) {
                    throw CustomError.fromError(new Error("Proton path not set"), BSLaunchError.PROTON_NOT_SET);
                }

                // Setup Proton environment variables
                Object.assign(env, {
                    "WINEDLLOVERRIDES": "winhttp=n,b", // Required for mods to work
                    "STEAM_COMPAT_DATA_PATH": compatDataPath,
                    "STEAM_COMPAT_INSTALL_PATH": bsFolderPath,
                    "STEAM_COMPAT_CLIENT_INSTALL_PATH": steamPath,
                    "STEAM_COMPAT_APP_ID": BS_APP_ID,
                    // Uncomment these to create a proton log file in the Beat Saber install directory.
                    // "PROTON_LOG": 1,
                    // "PROTON_LOG_DIR": bsFolderPath,
                });
            }

            obs.next({type: BSLaunchEvent.BS_LAUNCHING});

            const spawnOpts = { env, cwd: bsFolderPath };

            const launchPromise = !launchOptions.admin ? (
                this.launchBs(exePath, launchArgs, spawnOpts).exit
            ) : (
                new Promise<number>(resolve => {
                    const adminProcess = exec(`"${this.getStartBsAsAdminExePath()}" "${exePath}" ${launchArgs.join(" ")}`, spawnOpts);
                    adminProcess.on("error", err => {
                        log.error("Error while starting BS as Admin", err);
                        resolve(-1)
                    });

                    setTimeout(() => {
                        adminProcess.removeAllListeners("error");
                        resolve(-1);
                    }, 35_000);
                })
            );

            try {
                const exitCode = await launchPromise;
                log.info("BS process exit code", exitCode);
            }
            catch(err: any) {
                throw CustomError.fromError(err, BSLaunchError.BS_EXIT_ERROR);
            }
            finally {
                await this.restoreSteamVR().catch(log.error);
            }

        })().then(() => {
            obs.complete();
        }).catch(err => {
            if(err instanceof CustomError){
                obs.error(err);
            } else {
                obs.error(CustomError.fromError(err, BSLaunchError.UNKNOWN_ERROR));
            }
        })});
    }

}
