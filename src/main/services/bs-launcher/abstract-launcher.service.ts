import { LaunchOption } from "shared/models/bs-launch";
import { BSLocalVersionService } from "../bs-local-version.service";
import { ChildProcess, SpawnOptions } from "child_process";
import path from "path";
import log from "electron-log";
import { LinuxService } from "../linux.service";
import { BsmShellLog, bsmSpawn } from "main/helpers/os.helpers";
import { BS_EXECUTABLE, IS_FLATPAK } from "main/constants";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { app, Event } from "electron";
import { StaticConfigurationService } from "main/services/static-configuration.service";
import { focusProcessWindow } from "main/helpers/focus-process-window.helper";

export function buildBsLaunchArgs(launchOptions: LaunchOption): string[] {
    const launchArgs = [];

    if(!launchOptions.version.steam && !launchOptions.version.oculus){
        launchArgs.push("--no-yeet")
    }
    if(launchOptions.launchMods?.includes(LaunchMods.OCULUS)) {
        launchArgs.push("-vrmode");
        launchArgs.push("oculus");
    }
    if(launchOptions.launchMods?.includes(LaunchMods.FPFC)) {
        launchArgs.push("fpfc");
    }
    if(launchOptions.launchMods?.includes(LaunchMods.DEBUG)) {
        launchArgs.push("--verbose");
    }
    if(launchOptions.launchMods?.includes(LaunchMods.EDITOR)) {
        launchArgs.push("editor");
    }

    return Array.from(new Set(launchArgs).values());
}

export abstract class AbstractLauncherService {

    protected readonly linux = LinuxService.getInstance();
    protected readonly localVersions = BSLocalVersionService.getInstance();
    protected readonly staticConfig = StaticConfigurationService.getInstance();

    constructor(){
        this.linux = LinuxService.getInstance();
        this.localVersions = BSLocalVersionService.getInstance();
    }

    protected launchBeatSaberProcess(options: LaunchBeatSaberOptions): ChildProcess {
        const spawnOptions: SpawnOptions = {
            detached: true,
            cwd: options.beatSaberFolderPath,
            env: { ...options.customEnv, ...options.env },
            stdio: "ignore",
        };

        if (options.args?.includes("--verbose")){
            spawnOptions.windowsVerbatimArguments = true;
        }

        spawnOptions.shell = true; // For windows to spawn properly
        return bsmSpawn(options.cmdlet, {
            args: options.args, options: spawnOptions, log: BsmShellLog.Command,
            flatpak: {
                host: IS_FLATPAK,
                env: [
                    "SteamAppId",
                    "SteamOverlayGameId",
                    "SteamGameId",
                    "WINEDLLOVERRIDES",
                    "STEAM_COMPAT_DATA_PATH",
                    "STEAM_COMPAT_INSTALL_PATH",
                    "STEAM_COMPAT_CLIENT_INSTALL_PATH",
                    "STEAM_COMPAT_APP_ID",
                    "SteamEnv",
                    "OXR_PARALLEL_VIEWS",
                    "PROTON_LOG",
                    "PROTON_LOG_DIR",
                    ...Object.keys(options.customEnv || {})
                ],
            },
        });
    }

    protected launchBeatSaber(options: LaunchBeatSaberOptions): {process: ChildProcess, exit: Promise<number>} {
        const launchedAfter = new Date();
        const process = this.launchBeatSaberProcess(options);
        this.handleGameWindowReady(process, options.beatSaberFolderPath, launchedAfter);

        const exit = new Promise<number>((resolve, reject) => {
            // Don't remove, useful for debugging!
            // process.stdout.on("data", (data) => {
            //     log.info(`BS stdout: ${data}`);
            // });
            // process.stderr.on("data", (data) => {
            //     log.error(`BS stderr: ${data}`);
            // });

            const cleanup = () => app.removeListener("will-quit", onWillQuitHandler);
            const onWillQuitHandler = (event: Event) => {
                cleanup();
                if (!process.killed) {
                    event.preventDefault();
                    log.info(`Unref'ing BS process ${process.pid} on app will-quit`);
                    process.unref();
                    resolve(-1);
                    app.quit();
                }
            };

            process.once("error", (err) => {
                log.error(`Error while launching BS`, err);
                cleanup();
                reject(err);
            });

            process.once("exit", (code) => {
                log.info(`BS process exit with code ${code}`);
                cleanup();
                resolve(code);
            });

            app.on("will-quit", onWillQuitHandler);
        });

        return { process, exit };
    }

    protected handleGameWindowReady(
        process: ChildProcess,
        beatSaberFolderPath: string,
        launchedAfter: Date,
        ownedProcessId = process.pid,
        ownedProcessSignal: AbortSignal | undefined = undefined,
        ownedProcessStartedAt: Date | undefined = undefined
    ): void {
        const ownership = new AbortController();
        const abort = () => ownership.abort();
        const cleanup = () => {
            process.removeListener("error", abort);
            process.removeListener("exit", abort);
            ownedProcessSignal?.removeEventListener("abort", abort);
        };
        process.once("error", abort);
        process.once("exit", abort);
        ownedProcessSignal?.addEventListener("abort", abort, { once: true });
        if (ownedProcessSignal?.aborted) {
            abort();
        }

        focusProcessWindow(path.join(beatSaberFolderPath, BS_EXECUTABLE), {
            launchedAfter,
            processId: ownedProcessId,
            processStartedAt: ownedProcessStartedAt,
            signal: ownership.signal,
            onWindowReady: () => {
                if (!ownership.signal.aborted && this.staticConfig.get("close-bs-manager-on-launch")) {
                    process.unref();
                    ownership.abort();
                    app.quit();
                }
            },
        }).catch(error => {
            if (!ownership.signal.aborted) {
                log.error("Could not focus Beat Saber window", error);
            }
        }).finally(cleanup);
    }

    /**
     * Updates the env variables between the originalEnv (comming from the BSM)
     *   and customEnv (coming from the user).
     * - originalEnv keys will be overwritten with customEnv values
     * - customEnv keys will be removed if they exist in originalEnv
     */
    protected updateEnvVariables(
        originalEnv: Record<string, string>,
        customEnv: Record<string, string>
    ): void {
        for (const [ key, value ] of Object.entries(customEnv)) {
            const isOverride = key in originalEnv;

            log.info(
                isOverride ? "Overriding" : "Injecting",
                `${key}="${value}"`,
                "to the env launch command"
            );

            if (isOverride) {
                originalEnv[key] = value;
                delete customEnv[key];
            }
        }
    }

}

export type LaunchBeatSaberOptions = {
    // To be passed to the bsmSpawn helper function
    // Can be the Beat Saber exe or wrapper exe (for linux)
    cmdlet: string;
    env: Record<string, string>;
    // Should come from either launch options or custom launch mod.
    customEnv: Record<string, string>;
    beatSaberFolderPath: string;

    args?: string[]; // Appended to the cmdlet string
}
