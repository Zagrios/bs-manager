import cp from "child_process";
import log from "electron-log";
import psList from "ps-list";
import { IS_FLATPAK } from "main/constants";

type LinuxOptions = {
    // Add the prefix to the command
    //   eg. command - "./Beat Saber.exe" --no-yeet, prefix - "path/to/proton" run
    //     = "path/to/proton" run "./Beat Saber.exe" --no-yeet
    prefix: string;
};

// Only applied if package as flatpak
type FlatpakOptions = {
    // Force to use "flatpak-spawn --host" to run commands outside of the sandbox
    host: boolean;
    // Only copy the keys from options.env from bsmSpawn/bsmExec
    env?: string[];
};

export enum BsmShellLog {
    Command = 0x0000_0001,
    EnvVariables = 0x0000_0002,
};

interface BsmShellOptions<OptionsType> {
    args?: string[] | string;
    options?: OptionsType;
    // Look into BsmShellLog values
    log?: number;
    linux?: LinuxOptions;
    flatpak?: FlatpakOptions;
};

export type BsmSpawnOptions = BsmShellOptions<cp.SpawnOptions>;
export type BsmExecOptions = BsmShellOptions<cp.ExecOptions>;

function updateCommand(command: string, options: BsmSpawnOptions) {
    if (options?.args) {
        command += typeof(options.args) === "string"
            ? ` ${options.args}`
            : ` ${options.args.join(" ")}`;
    }

    if (process.platform === "linux") {
        // "/bin/sh" does not see flatpak-spawn
        // All distros should support "bash" by default
        options.options.shell = "bash";

        if (options.linux?.prefix) {
            command = `${options.linux.prefix} ${command}`;
        }

        if (options?.flatpak?.host) {
            const envArgs = (options?.flatpak?.env && options?.options?.env)
                && options.flatpak.env
                    .filter(envName => options.options.env[envName])
                    .map(envName =>
                         `--env=${envName}="${options.options.env[envName]}"`
                    )
                    .join(" ");
            command = `flatpak-spawn --host ${envArgs || ""} ${command}`;
        }
    }

    return command;
}

function logValues(shell: "spawn" | "exec", command: string, options?: BsmShellOptions<cp.SpawnOptions | cp.ExecOptions>) {
    const platform = process.platform === "win32" ? "Windows" : "Linux";
    const optionsLog = options?.log || 0;

    if ((optionsLog & BsmShellLog.EnvVariables) > 0) {
        log.info(platform, shell, "env", options?.options?.env);
    }

    if ((optionsLog & BsmShellLog.Command) > 0) {
        log.info(platform, shell, "command\n>", command);
    }
}

export function bsmSpawn(command: string, options?: BsmSpawnOptions) {
    options = options || {};
    options.options = options.options || {};
    command = updateCommand(command, options);

    logValues("spawn", command, options);

    return cp.spawn(command, options.options);
}

export function bsmExec(command: string, options?: BsmExecOptions): Promise<{
    stdout: string;
    stderr: string;
}> {
    options = options || {};
    options.options = options.options || {};
    command = updateCommand(command, options);

    logValues("exec", command, options);

    return new Promise((resolve, reject) => {
        cp.exec(command, options?.options || {}, (error: Error, stdout: string, stderr: string) => {
            if (error) { return reject(error); }
            resolve({ stdout, stderr });
        });
    });
}

// Transform command from "steam" to "[s]team"
// NOTE: Can add an option to isProcessRunning/getProcessId to ignore this transformation
//   in the future if needed
const transformProcessNameForPS = (name: string) => `[${name.at(0)}]${name.substring(1)}`;

async function isProcessRunningLinux(name: string): Promise<boolean> {
    if (!name) {
        return false;
    }

    try {
        const processName = transformProcessNameForPS(name);
        const { stdout: count } = await bsmExec(`ps awwxo args | grep -c "${processName}"`, {
            log: BsmShellLog.Command,
            flatpak: { host: IS_FLATPAK },
        });

        return +count.trim() > 0;
    } catch(error) {
        log.error(error);
        return false;
    };
}

async function getProcessIdWindows(name: string): Promise<number | null> {
    try {
        const processes = await psList();
        const process = processes.find(process => process.name?.includes(name) || process.cmd?.includes(name));
        return process?.pid;
    } catch (error) {
        log.error(error);
        return null;
    }
}

export const isProcessRunning = process.platform === "win32"
    ? isProcessRunningWindows
    : isProcessRunningLinux;

async function isProcessRunningWindows(name: string): Promise<boolean> {
    try {
        const processes = await psList();
        return processes.some(process =>
            process.name?.includes(name) || process.cmd?.includes(name)
        );
    } catch (error) {
        log.error(error);
        return false;
    }
}

async function getProcessIdLinux(name: string): Promise<number | null> {
    if (!name) {
        return null;
    }

    try {
        const processName = transformProcessNameForPS(name);
        const { stdout } = await bsmExec(`ps awwxo pid,args | grep "${processName}"`, {
            log: BsmShellLog.Command,
            flatpak: { host: IS_FLATPAK },
        });

        if (!stdout) {
            return null;
        }

        const line = stdout.split("\n")
            .map(line => line.trimStart())
            .find(line => line.includes(name) && !line.includes("grep"));
        return line ? +line.split(" ").at(0) : null;
    } catch(error) {
        log.error(error);
        return null;
    };
}

export const getProcessId = process.platform === "win32"
    ? getProcessIdWindows
    : getProcessIdLinux;

