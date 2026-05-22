import { Observable } from "rxjs";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, BSLaunchWarning, LaunchOption } from "../../../shared/models/bs-launch";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { pathExists } from "fs-extra";
import { SteamService } from "../steam.service";
import path from "path";
import { BS_APP_ID, BS_EXECUTABLE } from "../../constants";
import log from "electron-log";
import { AbstractLauncherService, buildBsLaunchArgs, LaunchBeatSaberOptions } from "./abstract-launcher.service";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { UtilsService } from "../utils.service";
import { exec, ChildProcessWithoutNullStreams } from "child_process";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { app, Event } from "electron";
import { parseLaunchOptions } from "main/helpers/launchOptions.helper";

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

    private getStartBsAsAdminExePath(): string {
        return path.join(this.util.getAssetsScriptsPath(), "start_beat_saber_admin.exe");
    }

    public async restoreSteamVR(): Promise<void> {
        log.info("SteamVR restore skipped; SteamVR file/folder guard disabled");
    }

    protected launchBeatSaber(options: LaunchBeatSaberOptions): {process: ChildProcessWithoutNullStreams, exit: Promise<number>} {
        const process = this.launchBeatSaberProcess(options);

        let timeoutId: NodeJS.Timeout;

        const exit = new Promise<number>((resolve, reject) => {
            // Don't remove, useful for debugging!
            // process.stdout.on("data", (data) => {
            //    log.info(`BS stdout: ${data}`);
            // });
            // process.stderr.on("data", (data) => {
            //    log.error(`BS stderr: ${data}`);
            // });

            const onWillQuitHandler = async (event: Event) => {
                app.removeListener('will-quit', onWillQuitHandler);
                if (!process.killed) {
                    event.preventDefault();
                    log.info(`Unref'ing BS process ${process.pid} on app will-quit`);
                    process.unref();
                    resolve(-1);
                    app.quit();
                }
            };

            process.on("error", (err) => {
                log.error(`Error while launching BS`, err);
                reject(err);
                app.removeListener('will-quit', onWillQuitHandler);
            });

            process.on("exit", (code) => {
                log.info(`BS process exit with code ${code}`);
                resolve(code);
                app.removeListener('will-quit', onWillQuitHandler);
            });

            app.on('will-quit', onWillQuitHandler);

            const unrefAfter = options?.unrefAfter ?? 1_000;

            timeoutId = setTimeout(() => {
                log.info("BS process still running after launch timeout; detaching", { pid: process.pid, unrefAfter });
                process.unref();
                process.removeAllListeners();
                app.removeListener('will-quit', onWillQuitHandler);
                resolve(-1);
            }, unrefAfter);
        }).finally(() => {
            clearTimeout(timeoutId);
        });

        return { process, exit };
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{

        return new Observable<BSLaunchEventData>(obs => {(async () => {
            const launchStartedAt = Date.now();
            const logStep = (step: string, data?: Record<string, unknown>) => {
                log.info("Steam launch step", {
                    step,
                    elapsedMs: Date.now() - launchStartedAt,
                    ...data,
                });
            };

            logStep("start", {
                version: launchOptions.version?.BSVersion,
                name: launchOptions.version?.name,
                steam: launchOptions.version?.steam,
                metadataStore: launchOptions.version?.metadata?.store,
                launchMods: launchOptions.launchMods,
                admin: launchOptions.admin,
                hasCustomCommand: !!launchOptions.command,
            });

            const bsFolderPath = await this.localVersions.getInstalledVersionPath(launchOptions.version);
            logStep("resolved-version-path", { bsFolderPath });
            const bsExePath = path.join(bsFolderPath, BS_EXECUTABLE);

            if(!(await pathExists(bsExePath))){
                throw CustomError.fromError(new Error(`Path not exist : ${bsExePath}`), BSLaunchError.BS_NOT_FOUND);
            }
            logStep("validated-exe", { bsExePath });

            const skipSteam: boolean = launchOptions.launchMods?.includes(LaunchMods.SKIP_STEAM) ?? false;

            // Open Steam if not running
            const steamRunning = await this.steam.isSteamRunning();
            const steamProcessRunning = steamRunning || await this.steam.isSteamProcessRunning();
            logStep("steam-state", { skipSteam, steamRunning, steamProcessRunning });

            if(!skipSteam && !steamProcessRunning){

                obs.next({type: BSLaunchEvent.STEAM_LAUNCHING});
                logStep("open-steam-start");

                await this.steam.openSteam().then(() => {
                    obs.next({type: BSLaunchEvent.STEAM_LAUNCHED});
                    logStep("open-steam-done");
                }).catch(e => {
                    log.error(e);
                    obs.next({type: BSLaunchWarning.UNABLE_TO_LAUNCH_STEAM});
                    logStep("open-steam-failed");
                });
            }
            else if(skipSteam) {
                obs.next({ type: BSLaunchEvent.SKIPPING_STEAM_LAUNCH});
                logStep("skip-steam");
            }
            else if(!steamRunning) {
                log.warn("Steam process is running, but active user is unavailable. Skipping Steam startup wait.");
                logStep("steam-active-user-missing");
            }

            const fpfcEnabled = launchOptions.launchMods?.includes(LaunchMods.FPFC) ?? false;

            const steamPath = await this.steam.getSteamPath();
            logStep("resolved-steam-path", { steamPath });

            let env: Record<string, string> = {
                ...process.env,
                "SteamAppId": BS_APP_ID,
                "SteamOverlayGameId": BS_APP_ID,
                "SteamGameId": BS_APP_ID,
            };

            if (process.platform === "win32" && fpfcEnabled) {
                env.XR_RUNTIME_JSON = path.join(bsFolderPath, "BSManager_FPFC_NoOpenXR_Runtime.json");
                log.info("Overriding OpenXR runtime for FPFC launch", { XR_RUNTIME_JSON: env.XR_RUNTIME_JSON });
            }

            // Linux setup
            if (process.platform === "linux") {
                if (launchOptions.admin) {
                    log.warn("Launching as admin is not supported on Linux! Starting the game as a normal user.");
                    launchOptions.admin = false;
                }

                Object.assign(env, await this.linux.buildEnvVariables(
                    launchOptions, steamPath, bsFolderPath
                ));
            }

            const {
                env: parsedEnv,
                cmdlet, args
            } = parseLaunchOptions(launchOptions.command, {
                commandReplacement: process.platform === "win32"
                    ? `"${bsExePath}"`
                    : `${await this.linux.getProtonPrefix()} "${bsExePath}"`,
            });
            env = this.mergeEnvVariables(env, parsedEnv);

            const launchArgs = buildBsLaunchArgs(launchOptions);
            logStep("parsed-launch-command", { cmdlet, args, launchArgs });

            obs.next({type: BSLaunchEvent.BS_LAUNCHING});

            const spawnOpts = { env, cwd: bsFolderPath };

            const launchPromise = !launchOptions.admin ? (
                logStep("spawn-bs-start"),
                this.launchBeatSaber({
                    env, cmdlet,
                    args: args
                        ? [ args, ...launchArgs ]
                        : launchArgs,
                    beatSaberFolderPath: bsFolderPath,
                }).exit
            ) : (
                new Promise<number>(resolve => {
                    logStep("spawn-bs-admin-start");
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
                logStep("launch-promise-resolved", { exitCode });
            }
            catch(err: any) {
                logStep("launch-promise-error");
                throw CustomError.fromError(err, BSLaunchError.BS_EXIT_ERROR);
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
