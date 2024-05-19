import { LaunchOption } from "shared/models/bs-launch";
import { BSLocalVersionService } from "../bs-local-version.service";
import { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio, spawn } from "child_process";
import path from "path";
import log from "electron-log";

export abstract class AbstractLauncherService {

    protected readonly localVersions = BSLocalVersionService.getInstance();

    constructor(){
        this.localVersions = BSLocalVersionService.getInstance();
    }

    protected buildBsLaunchArgs(launchOptions: LaunchOption): string[]{
        const launchArgs = ["--no-yeet"];

        if (launchOptions.oculus) {
            launchArgs.push("-vrmode");
            launchArgs.push("oculus");
        }
        if (launchOptions.desktop) {
            launchArgs.push("fpfc");
        }
        if (launchOptions.debug) {
            launchArgs.push("--verbose");
        }
        if (launchOptions.additionalArgs) {
            launchArgs.push(...launchOptions.additionalArgs);
        }

        return Array.from(new Set(launchArgs).values());
    }

    protected launchBSProcess(bsExePath: string, args: string[], options?: SpawnOptionsWithoutStdio): ChildProcessWithoutNullStreams {

        const spawnOptions: SpawnOptionsWithoutStdio = { detached: true, cwd: path.dirname(bsExePath), ...(options || {}) };

        if(args.includes("--verbose")){
            spawnOptions.windowsVerbatimArguments = true;
        }

        log.info(`Launch BS exe at ${bsExePath} with args ${args?.join(" ")}`);

        return spawn(bsExePath, args, spawnOptions);

    }

    protected launchBs(bsExePath: string, args: string[], options?: SpawnOptionsWithoutStdio): {process: ChildProcessWithoutNullStreams, exit: Promise<number>} {
        const process = this.launchBSProcess(bsExePath, args, options);

        const exit = new Promise<number>((resolve, reject) => {
            process.on("error", (err) => {
                log.error(`Error while launching BS`, err);
                reject(err);
            });
            process.on("exit", (code) => {
                log.info(`BS process exit with code ${code}`);
                resolve(code);
            });

            setTimeout(() => {
                process.removeAllListeners("error");
                process.removeAllListeners("exit");
                resolve(-1);
            }, 30_000);
        });

        return { process, exit };
    }
}
