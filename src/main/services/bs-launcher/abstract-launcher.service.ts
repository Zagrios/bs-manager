import { LaunchOption } from "shared/models/bs-launch";
import { BSLocalVersionService } from "../bs-local-version.service";
import { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "child_process";
import log from "electron-log";
import { sToMs } from "../../../shared/helpers/time.helpers";
import { LinuxService } from "../linux.service";
import { BsmShellLog, bsmSpawn } from "main/helpers/os.helpers";
import { IS_FLATPAK } from "main/constants";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";

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

    constructor(){
        this.linux = LinuxService.getInstance();
        this.localVersions = BSLocalVersionService.getInstance();
    }

    protected launchBeatSaberProcess(options: LaunchBeatSaberOptions): ChildProcessWithoutNullStreams {
        const spawnOptions: SpawnOptionsWithoutStdio = {
            detached: true,
            cwd: options.beatSaberFolderPath,
            env: options.env,
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
                    "PROTON_LOG",
                    "PROTON_LOG_DIR",
                ],
            },
        });
    }

    protected launchBeatSaber(options: LaunchBeatSaberOptions): {process: ChildProcessWithoutNullStreams, exit: Promise<number>} {
        const process = this.launchBeatSaberProcess(options);

        let timeoutId: NodeJS.Timeout;

        const exit = new Promise<number>((resolve, reject) => {
            // Don't remove, useful for debugging!
            // process.stdout.on("data", (data) => {
            //     log.info(`BS stdout: ${data}`);
            // });
            // process.stderr.on("data", (data) => {
            //     log.error(`BS stderr: ${data}`);
            // });

            process.on("error", (err) => {
                log.error(`Error while launching BS`, err);
                reject(err);
            });

            process.on("exit", (code) => {
                log.info(`BS process exit with code ${code}`);
                resolve(code);
            });

            const unrefAfter = options?.unrefAfter ?? sToMs(10);

            timeoutId = setTimeout(() => {
                log.error("BS process unref after timeout", unrefAfter);
                process.unref();
                process.removeAllListeners();
                resolve(-1);
            }, unrefAfter);

        }).finally(() => {
            clearTimeout(timeoutId);
        });

        return { process, exit };
    }

    // Launch option helper function
    protected mergeEnvVariables(
        originalEnv: Record<string, string>,
        newEnv: Record<string, string>
    ): Record<string, string> {
        const env = { ...originalEnv };
        for (const [ key, value ] of Object.entries(newEnv)) {
            log.info(
                key in env ? "Overriding" : "Injecting",
                `${key}="${value}"`,
                "to the env launch command"
            );
            env[key] = value;
        }
        return env;
    }

}

export type LaunchBeatSaberOptions = {
    // To be passed to the bsmSpawn helper function
    // Can be the Beat Saber exe or wrapper exe (for linux)
    cmdlet: string;
    env: Record<string, string>;
    beatSaberFolderPath: string;

    args?: string[]; // Appended to the cmdlet string

    // Timeout value (in ms) to unref the Beat Saber process to BSM
    unrefAfter?: number;
}

