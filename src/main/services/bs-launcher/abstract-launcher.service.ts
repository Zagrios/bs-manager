import { LaunchOption } from "shared/models/bs-launch";
import { BSLocalVersionService } from "../bs-local-version.service";
import { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio, spawn } from "child_process";
import path from "path";
import log from "electron-log";
import { sToMs } from "../../../shared/helpers/time.helpers";

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

    protected launchBs(bsExePath: string, args: string[], options?: SpawnBsProcessOptions): {process: ChildProcessWithoutNullStreams, exit: Promise<number>} {
        const process = this.launchBSProcess(bsExePath, args, options);

        let timoutId: NodeJS.Timeout;

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

            timoutId = setTimeout(() => {
                log.error("BS process unref after timeout", unrefAfter);
                process.unref();
                process.removeAllListeners();
                resolve(-1);
            }, unrefAfter);

        }).finally(() => {
            clearTimeout(timoutId);
        });

        return { process, exit };
    }
}

export type SpawnBsProcessOptions = {
    unrefAfter?: number;
} & SpawnOptionsWithoutStdio;
