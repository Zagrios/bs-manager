import { Observable } from "rxjs";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, BSLaunchWarning, LaunchOption } from "../../../shared/models/bs-launch";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { pathExists, rename } from "fs-extra";
import { SteamService } from "../steam.service";
import path from "path";
import { BS_APP_ID, BS_EXECUTABLE, STEAMVR_APP_ID } from "../../constants";
import log from "electron-log";
import { AbstractLauncherService, buildBsLaunchArgs, LaunchBeatSaberOptions } from "./abstract-launcher.service";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { UtilsService } from "../utils.service";
import { exec, spawn, ChildProcess, ExecOptions } from "child_process";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { app, Event } from "electron";
import { parseLaunchOptions } from "main/helpers/launchOptions.helper";
import { getProcessIds } from "main/helpers/os.helpers";

const STEAM_VR_RESTORE_WATCHER_SCRIPT = `
$ownedProcess = $null
$findDeadline = [DateTime]::UtcNow.AddSeconds(60)

do {
    $ownedProcess = Get-Process -Name "Beat Saber" -ErrorAction SilentlyContinue |
        Where-Object {
            try {
                $_.Path -ieq $TargetExecutablePath -and
                    $_.StartTime.ToUniversalTime() -ge $LaunchStartedAfterUtc
            }
            catch {
                $false
            }
        } |
        Sort-Object StartTime -Descending |
        Select-Object -First 1

    if ($null -eq $ownedProcess) {
        Start-Sleep -Milliseconds 500
    }
} while ($null -eq $ownedProcess -and [DateTime]::UtcNow -lt $findDeadline)

if ($null -ne $ownedProcess) {
    $ownedProcessId = $ownedProcess.Id
    while ($null -ne (Get-Process -Id $ownedProcessId -ErrorAction SilentlyContinue)) {
        Start-Sleep -Seconds 1
    }
}

for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if (!(Test-Path -LiteralPath $SteamVrBackupPath)) {
        exit 0
    }

    if (!(Test-Path -LiteralPath $SteamVrFolderPath)) {
        try {
            Move-Item -LiteralPath $SteamVrBackupPath -Destination $SteamVrFolderPath -ErrorAction Stop
            exit 0
        }
        catch {
        }
    }

    Start-Sleep -Seconds 1
}

exit 3
`;

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

    private timedRename(src: string, dest: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Rename timed out")), 5000);
            rename(src, dest).then(resolve, reject).finally(() => clearTimeout(timeout));
        });
    }

    private async backupSteamVR(): Promise<boolean> {
        const steamVrFolder = await this.getSteamVRPath();
        if (!steamVrFolder || !(await pathExists(steamVrFolder))) {
            return false;
        }
        try {
            await this.timedRename(steamVrFolder, `${steamVrFolder}.bak`);
            return false;
        } catch (err: any) {
            log.warn("Could not backup SteamVR folder, skipping", err);
            return err?.code === "EPERM" || err?.message?.includes("timed out");
        }
    }

    private getStartBsAsAdminExePath(): string {
        return path.join(this.util.getAssetsScriptsPath(), "start_beat_saber_admin.exe");
    }

    public async restoreSteamVR(): Promise<void> {
        const steamVrFolder = await this.getSteamVRPath();
        if (!steamVrFolder) { return; }
        const steamVrBackup = `${steamVrFolder}.bak`;
        if (!(await pathExists(steamVrBackup))) { return; }
        return this.timedRename(steamVrBackup, steamVrFolder).catch(err => {
            log.warn("Could not restore SteamVR folder", err);
        });
    }

    private async handoffSteamVRRestore(bsExePath: string, launchedAfter: Date): Promise<void> {
        const steamVrFolder = await this.getSteamVRPath();
        if (!steamVrFolder) { return; }
        const steamVrBackup = `${steamVrFolder}.bak`;
        if (!(await pathExists(steamVrBackup))) { return; }

        const encode = (value: string) => Buffer.from(value, "utf8").toString("base64");
        const script = `$TargetExecutablePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(bsExePath)}'))
$SteamVrFolderPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(steamVrFolder)}'))
$SteamVrBackupPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encode(steamVrBackup)}'))
$LaunchStartedAfterUtc = [DateTime]::Parse('${launchedAfter.toISOString()}').ToUniversalTime()
${STEAM_VR_RESTORE_WATCHER_SCRIPT}`;
        const encodedScript = Buffer.from(script, "utf16le").toString("base64");
        const watcher = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript], {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
        });
        await new Promise<void>((resolve, reject) => {
            const onError = (error: Error) => {
                watcher.removeListener("spawn", onSpawn);
                reject(error);
            };
            const onSpawn = () => {
                watcher.removeListener("error", onError);
                watcher.once("error", error => log.error("SteamVR restore watcher error", error));
                watcher.unref();
                resolve();
            };

            watcher.once("error", onError);
            watcher.once("spawn", onSpawn);
        });
    }

    private async launchBeatSaberAsAdmin(bsExePath: string, launchArgs: string[], options: ExecOptions): Promise<number> {
        const existingProcessIds = new Set(await getProcessIds(BS_EXECUTABLE));
        const launchedAfter = new Date();
        let restoreHandedOff = false;
        const helperExitCode = await new Promise<number>((resolve, reject) => {
            const adminProcess = exec(`"${this.getStartBsAsAdminExePath()}" "${bsExePath}" ${launchArgs.join(" ")} --log-path "${path.join(app.getPath("logs"), "bs-admin-start.log")}"`, options);
            this.handleGameWindowReady(adminProcess, path.dirname(bsExePath), launchedAfter);

            let handoffPending = false;
            let settleHelperAfterHandoff: (() => void) | undefined;
            const cleanup = () => app.removeListener("will-quit", onWillQuitHandler);
            const onWillQuitHandler = async (event: Event) => {
                if (!adminProcess.killed) {
                    event.preventDefault();
                    if (handoffPending) { return; }
                    handoffPending = true;
                    log.info(`Unref'ing admin launcher process ${adminProcess.pid} on app will-quit`);
                    try {
                        await this.handoffSteamVRRestore(bsExePath, launchedAfter);
                    } catch (error) {
                        handoffPending = false;
                        log.error("Could not hand off SteamVR restoration", error);
                        settleHelperAfterHandoff?.();
                        settleHelperAfterHandoff = undefined;
                        return;
                    }
                    restoreHandedOff = true;
                    settleHelperAfterHandoff = undefined;
                    cleanup();
                    adminProcess.unref();
                    app.quit();
                } else {
                    cleanup();
                }
            };

            adminProcess.once("error", err => {
                log.error("Error while starting BS as Admin", err);
                const settle = () => {
                    cleanup();
                    reject(err);
                };
                if (handoffPending) {
                    settleHelperAfterHandoff ??= settle;
                } else if (!restoreHandedOff) {
                    settle();
                }
            });
            adminProcess.once("exit", code => {
                const settle = () => {
                    cleanup();
                    resolve(code ?? -1);
                };
                if (handoffPending) {
                    settleHelperAfterHandoff ??= settle;
                } else if (!restoreHandedOff) {
                    settle();
                }
            });
            app.on("will-quit", onWillQuitHandler);
        });

        if (helperExitCode !== 0) {
            return helperExitCode;
        }
        const ownedProcessId = (await getProcessIds(BS_EXECUTABLE)).find(processId => !existingProcessIds.has(processId));
        if (ownedProcessId === undefined) {
            return helperExitCode;
        }

        return new Promise<number>((resolve, reject) => {
            let pollTimer: NodeJS.Timeout;
            let handoffPending = false;
            const cleanup = () => {
                clearTimeout(pollTimer);
                app.removeListener("will-quit", onWillQuitHandler);
            };
            const onWillQuitHandler = async (event: Event) => {
                event.preventDefault();
                if (handoffPending) { return; }
                handoffPending = true;
                try {
                    await this.handoffSteamVRRestore(bsExePath, launchedAfter);
                } catch (error) {
                    handoffPending = false;
                    log.error("Could not hand off SteamVR restoration", error);
                    return;
                }
                cleanup();
                app.quit();
            };
            const pollBeatSaber = () => {
                getProcessIds(BS_EXECUTABLE).then(processIds => {
                    if (processIds.includes(ownedProcessId)) {
                        pollTimer = setTimeout(pollBeatSaber, 1_000);
                    } else {
                        cleanup();
                        resolve(0);
                    }
                }).catch(error => {
                    cleanup();
                    reject(error);
                });
            };

            app.on("will-quit", onWillQuitHandler);
            pollBeatSaber();
        });
    }

    protected launchBeatSaber(options: LaunchBeatSaberOptions): {process: ChildProcess, exit: Promise<number>} {
        const launchedAfter = new Date();
        const process = this.launchBeatSaberProcess(options);
        this.handleGameWindowReady(process, options.beatSaberFolderPath, launchedAfter);

        const exit = new Promise<number>((resolve, reject) => {
            // Don't remove, useful for debugging!
            // process.stdout.on("data", (data) => {
            //    log.info(`BS stdout: ${data}`);
            // });
            // process.stderr.on("data", (data) => {
            //    log.error(`BS stderr: ${data}`);
            // });

            let handoffPending = false;
            const onWillQuitHandler = async (event: Event) => {
                if (!process.killed) {
                    event.preventDefault();
                    if (handoffPending) { return; }
                    handoffPending = true;
                    log.info(`Unref'ing BS process ${process.pid} on app will-quit`);
                    try {
                        await this.handoffSteamVRRestore(path.join(options.beatSaberFolderPath, BS_EXECUTABLE), launchedAfter);
                    } catch (error) {
                        handoffPending = false;
                        log.error("Could not hand off SteamVR restoration", error);
                        return;
                    }
                    app.removeListener('will-quit', onWillQuitHandler);
                    process.unref();
                    app.quit();
                } else {
                    app.removeListener('will-quit', onWillQuitHandler);
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
        });

        return { process, exit };
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{

        return new Observable<BSLaunchEventData>(obs => {(async () => {

            const bsFolderPath = await this.localVersions.getInstalledVersionPath(launchOptions.version);
            const bsExePath = path.join(bsFolderPath, BS_EXECUTABLE);

            if(!(await pathExists(bsExePath))){
                throw CustomError.fromError(new Error(`Path not exist : ${bsExePath}`), BSLaunchError.BS_NOT_FOUND);
            }

            const skipSteam = launchOptions.launchMods?.includes(LaunchMods.SKIP_STEAM) ?? false;

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

            const isFpfc = launchOptions.launchMods?.includes(LaunchMods.FPFC);
            const isOculus = launchOptions.launchMods?.includes(LaunchMods.OCULUS);
            if(isFpfc && !isOculus){
                const backupPermError = await this.backupSteamVR()
                    .catch(async () => this.restoreSteamVR().then(() => false));
                if(backupPermError){
                    obs.next({type: BSLaunchWarning.FPFC_NEED_ADMIN});
                }
            } else if(!isFpfc) {
                await this.restoreSteamVR().catch(log.error);
            }

            const steamPath = await this.steam.getSteamPath();

            const env: Record<string, string> = {
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

                Object.assign(env, await this.linux.buildEnvVariables(
                    launchOptions, steamPath, bsFolderPath
                ));
            }

            const {
                env: customEnv,
                cmdlet, args
            } = parseLaunchOptions(launchOptions.command, {
                commandReplacement: process.platform === "win32"
                    ? `"${bsExePath}"`
                    : `${await this.linux.getProtonPrefix()} "${bsExePath}"`,
            });
            this.updateEnvVariables(env, customEnv);

            const launchArgs = buildBsLaunchArgs(launchOptions);

            obs.next({type: BSLaunchEvent.BS_LAUNCHING});

            const spawnOpts = { env: { ...customEnv, ...env }, cwd: bsFolderPath };

            const launchPromise = !launchOptions.admin ? (
                this.launchBeatSaber({
                    env, customEnv, cmdlet,
                    args: args
                        ? [ args, ...launchArgs ]
                        : launchArgs,
                    beatSaberFolderPath: bsFolderPath,
                }).exit
            ) : this.launchBeatSaberAsAdmin(bsExePath, launchArgs, spawnOpts);

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
