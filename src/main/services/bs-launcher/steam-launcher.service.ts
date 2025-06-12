import { Observable } from "rxjs";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, BSLaunchWarning, LaunchOption } from "../../../shared/models/bs-launch";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { pathExists, rename } from "fs-extra";
import { SteamService } from "../steam.service";
import path from "path";
import { BS_APP_ID, BS_EXECUTABLE, STEAMVR_APP_ID } from "../../constants";
import log from "electron-log";
import { AbstractLauncherService, buildBsLaunchArgs } from "./abstract-launcher.service";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { UtilsService } from "../utils.service";
import { exec } from "child_process";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { app, Event } from "electron";
import { sToMs } from "shared/helpers/time.helpers";
import fs from 'fs/promises';
import { BSMHookService } from "./bsm-hook.service";

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
    private readonly bsmhook: BSMHookService;

    private constructor(){
        super();
        this.steam = SteamService.getInstance();
        this.util = UtilsService.getInstance();
        this.bsmhook = BSMHookService.getInstance();
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
            const bsExePath = path.join(bsFolderPath, BS_EXECUTABLE);

            if(!(await pathExists(bsExePath))){
                throw CustomError.fromError(new Error(`Path not exist : ${bsExePath}`), BSLaunchError.BS_NOT_FOUND);
            }

            const skipSteam: boolean = launchOptions.launchMods?.includes(LaunchMods.SKIP_STEAM) ?? false;

            // Open Steam if not running
            if(!skipSteam && !(await this.steam.isSteamRunning())){

                obs.next({type: BSLaunchEvent.STEAM_LAUNCHING});

                await this.steam.openSteam().then(() => {
                    obs.next({type: BSLaunchEvent.STEAM_LAUNCHED});
                }).catch(e => {
                    log.error(e);
                    obs.next({type: BSLaunchWarning.UNABLE_TO_LAUNCH_STEAM});
                });
            }
            else if(skipSteam) {
                obs.next({ type: BSLaunchEvent.SKIPPING_STEAM_LAUNCH});
            }

            // Backup SteamVR when desktop mode is enabled
            if(launchOptions.launchMods?.includes(LaunchMods.FPFC)){
                await this.backupSteamVR().catch(() => {
                    return this.restoreSteamVR();
                });
            } else {
                await this.restoreSteamVR().catch(log.error);
            }

            if (launchOptions.launchMods?.includes(LaunchMods.BSM_HOOK) && !(await pathExists(path.join(bsFolderPath, 'Plugins', 'BSMHook.dll')))) {
                const DLL_URL = 'https://arimodu.dev/BSMHook.dll';

                try {
                    const response = await fetch(DLL_URL);
                    if (!response.ok) {
                        throw new Error(`Failed to download BSMHook.dll: ${response.statusText}`);
                    }

                    const dllPath = path.join(bsFolderPath, 'Plugins', 'BSMHook.dll');
                    const buffer = await response.arrayBuffer();
                    await fs.writeFile(dllPath, Buffer.from(buffer));

                    log.info('BSMHook.dll downloaded successfully');
                } catch (error) {
                    log.error('Failed to download BSMHook.dll:', error);
                }
            }

            if (!launchOptions.launchMods?.includes(LaunchMods.BSM_HOOK) && await pathExists(path.join(bsFolderPath, 'Plugins', 'BSMHook.dll'))) {
                try {
                    const dllPath = path.join(bsFolderPath, 'Plugins', 'BSMHook.dll');
                    await fs.unlink(dllPath);

                    log.info('BSMHook.dll deleted successfully');
                } catch (error) {
                    log.error('Failed to delete BSMHook.dll:', error);
                }
            }

            const steamPath = await this.steam.getSteamPath();

            const env = {
                ...process.env,
                "SteamAppId": BS_APP_ID,
                "SteamOverlayGameId": BS_APP_ID,
                "SteamGameId": BS_APP_ID,
            };

            let protonPrefix = "";
            // Linux setup
            if (process.platform === "linux") {
                const linuxSetup = await this.linux.setupLaunch(
                    launchOptions, steamPath, bsFolderPath
                );
                protonPrefix = linuxSetup.protonPrefix;
                Object.assign(env, linuxSetup.env);
            }

            this.injectAdditionalArgsEnvs(launchOptions, env);
            const launchArgs = buildBsLaunchArgs(launchOptions);

            obs.next({type: BSLaunchEvent.BS_LAUNCHING});

            const spawnOpts = { env, cwd: bsFolderPath };

            const launchPromise = !launchOptions.admin ? (
                new Promise<number>(async (resolve, reject) => {
                    const process = this.launchBSProcess(bsExePath, launchArgs, { ...spawnOpts, protonPrefix });

                    const unrefAndResolve = (code: number) => {
                        app.removeListener('will-quit', onWillQuitHandler);
                        resolve(code);
                    }

                    if (await pathExists(path.join(bsFolderPath, 'Plugins', 'BSMHook.dll'))) {
                        log.info('BSMHook.dll installed, waiting for game reports...');
                        this.bsmhook.start((d) => {
                            if (d.includes('MainMenu')) {
                                this.bsmhook.close();
                                unrefAndResolve(-1);
                            }
                        }, (err) => {
                            this.bsmhook.close();
                            log.warn(`Failed while running BSMHook: ${err.message}`);
                            setTimeout(() => {
                                log.info("Resolved promise after timeout (BSMHook fail)");
                                unrefAndResolve(-1);
                            }, sToMs(10));
                        });
                    }
                    else {
                        setTimeout(() => {
                            log.info("Resolved promise after timeout (10s)");
                            unrefAndResolve(-1); // Put this in a timeout for visual effect (game window may take a bit to open, lets trick users into thinking stuffs happening...)
                        }, sToMs(10));
                    }

                    const onWillQuitHandler = async (event: Event) => {
                        app.removeListener('will-quit', onWillQuitHandler);
                        if (!process.killed) {
                            event.preventDefault();
                            log.info(`Unref'ing BS process ${process.pid} on app will-quit`);
                            unrefAndResolve(-1);
                            app.quit();
                        }
                    };

                    process.on("error", async (err) => {
                        log.error(`Error while launching BS`, err);
                        reject(err);
                        app.removeListener('will-quit', onWillQuitHandler);
                    });

                    process.on("exit", async (code) => {
                        log.info(`BS process exit with code ${code}`);
                        unrefAndResolve(code);
                    });

                    app.on('will-quit', onWillQuitHandler);
                })
            ) : (
                new Promise<number>(resolve => {
                    const adminProcess = exec(`"${this.getStartBsAsAdminExePath()}" "${bsExePath}" ${launchArgs.join(" ")} --log-path "${path.join(app.getPath("logs"), "bs-admin-start.log")}"`, spawnOpts);
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
