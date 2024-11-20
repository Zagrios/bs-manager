import cp from "child_process";
import log from "electron-log";
import psList from "ps-list";
import { IS_FLATPAK } from "main/constants";

// There are 2 erroneous lines ps | grep which is both the ps and grep calls themselves
const MIN_PROCESS_COUNT_LINUX = 2;

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

export type BsmSpawnOptions = {
    args?: string[];
    options?: cp.SpawnOptions;
    log?: boolean;
    linux?: LinuxOptions;
    flatpak?: FlatpakOptions;
};

export type BsmExecOptions = {
    args?: string[];
    options?: cp.ExecOptions;
    log?: boolean;
    linux?: LinuxOptions;
    flatpak?: FlatpakOptions;
};

function updateCommand(command: string, options: BsmSpawnOptions) {
    if (options?.args) {
        command += ` ${options.args.join(" ")}`;
    }

    if (process.platform === "linux") {
        // "/bin/sh" does not see flatpak-spawn
        // Most Debian and Arch should also support "/bin/bash"
        options.options.shell = "/bin/bash";

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

export function bsmSpawn(command: string, options?: BsmSpawnOptions) {
    options = options || {};
    options.options = options.options || {};
    command = updateCommand(command, options);

    if (options?.log) {
        log.info(process.platform === "win32" ? "Windows" : "Linux", "spawn command\n>", command);
    }

    return cp.spawn(command, options.options);
}

export function bsmExec(command: string, options?: BsmExecOptions): Promise<{
    stdout: string;
    stderr: string;
}> {
    options = options || {};
    options.options = options.options || {};
    command = updateCommand(command, options);

    if (options?.log) {
        log.info(
            process.platform === "win32" ? "Windows" : "Linux",
            "exec command\n>", command
        );
    }

    return new Promise((resolve, reject) => {
        cp.exec(command, options?.options || {}, (error: Error, stdout: string, stderr: string) => {
            if (error) { return reject(error); }
            resolve({ stdout, stderr });
        });
    });
}

async function isProcessRunningLinux(name: string): Promise<boolean> {
    try {
        const { stdout: count } = await bsmExec(`ps awwxo args | grep -c "${name}"`, {
            log: true,
            flatpak: { host: IS_FLATPAK },
        });

        return +count.trim() > MIN_PROCESS_COUNT_LINUX;
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
    try {
        const { stdout } = await bsmExec(`ps awwxo pid,args | grep "${name}"`, {
            log: true,
            flatpak: { host: IS_FLATPAK },
        });

        const line = stdout.split("\n")
            .slice(0, -MIN_PROCESS_COUNT_LINUX)
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

