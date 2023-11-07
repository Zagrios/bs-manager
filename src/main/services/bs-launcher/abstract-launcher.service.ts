import { LaunchOption } from "shared/models/bs-launch";
import { BSLocalVersionService } from "../bs-local-version.service";
import { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio, spawn } from "child_process";
import path from "path";

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

        return spawn(bsExePath, args, spawnOptions);

    }

    protected launchBs(bsExePath: string, args: string[], options?: SpawnOptionsWithoutStdio): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            const bsProcess = this.launchBSProcess(bsExePath, args, options);

            bsProcess.on("error", reject);
            bsProcess.on("exit", resolve);

            setTimeout(() => {
                bsProcess.removeAllListeners("error");
                bsProcess.removeAllListeners("exit");
                resolve(-1);
            }, 30_000);
        });
    }
}