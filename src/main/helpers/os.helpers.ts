import cp from "child_process";
import log from "electron-log";
import psList from "ps-list";
import { IS_FLATPAK } from "main/constants";
import { getWindowsProcessesByName } from "./windows-powershell.helper";
import { readFile } from "fs/promises";

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

const processMatchesName = (process: Awaited<ReturnType<typeof psList>>[number], name: string) =>
    process.name?.includes(name) || process.cmd?.includes(name);

export type ProcessDetails = {
    ancestorPids?: number[];
    cmd?: string;
    name?: string;
    pid: number;
    ppid?: number;
    processGroupId?: number;
    startMarker?: string;
    startTime?: Date | number | string;
};

type LinuxProcessMetadata = {
    processGroupId: number;
    startTime: Date;
};

async function getLinuxProcessMetadata(processIds: number[]): Promise<Map<number, LinuxProcessMetadata>> {
    if (processIds.length === 0) {
        return new Map();
    }

    const stdout = await new Promise<string>((resolve, reject) => {
        cp.execFile(
            "ps",
            ["-o", "pid=,pgid=,lstart=", "-p", processIds.join(",")],
            { env: { ...process.env, LC_ALL: "C" } },
            (error, output) => error ? reject(error) : resolve(output)
        );
    });
    const metadata = new Map<number, LinuxProcessMetadata>();
    for (const line of stdout.split("\n")) {
        const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/);
        if (!match) { continue; }
        const processId = Number(match[1]);
        const processGroupId = Number(match[2]);
        const startTime = new Date(match[3]);
        if (Number.isSafeInteger(processId) && Number.isSafeInteger(processGroupId)
            && Number.isFinite(startTime.getTime())) {
            metadata.set(processId, { processGroupId, startTime });
        }
    }
    return metadata;
}

async function getLinuxProcessStartMarker(processId: number): Promise<string | undefined> {
    try {
        const stat = await readFile(`/proc/${processId}/stat`, "utf8");
        const fieldsAfterName = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
        return fieldsAfterName[19];
    } catch {
        return undefined;
    }
}

function getAncestorPids(
    processId: number,
    processesById: Map<number, Awaited<ReturnType<typeof psList>>[number]>
): number[] {
    const ancestorPids: number[] = [];
    const visited = new Set<number>([processId]);
    let parentId = processesById.get(processId)?.ppid;
    while (Number.isSafeInteger(parentId) && (parentId ?? 0) > 0 && !visited.has(parentId!)) {
        ancestorPids.push(parentId!);
        visited.add(parentId!);
        parentId = processesById.get(parentId!)?.ppid;
    }
    return ancestorPids;
}

export async function getProcessesByName(name: string): Promise<ProcessDetails[]> {
    if (!name) {
        return [];
    }
    if (process.platform === "win32") {
        return getWindowsProcessesByName(name);
    }
    const processes = await psList();
    const matchingProcesses = processes.filter(process => processMatchesName(process, name));
    const metadata = await getLinuxProcessMetadata(matchingProcesses.map(process => process.pid));
    const processesById = new Map(processes.map(process => [process.pid, process]));
    return Promise.all(matchingProcesses.map(async processDetails => ({
        ...processDetails,
        ...metadata.get(processDetails.pid),
        ancestorPids: getAncestorPids(processDetails.pid, processesById),
        startMarker: await getLinuxProcessStartMarker(processDetails.pid),
    })));
}

async function getProcessIdWindows(name: string): Promise<number | null> {
    try {
        const processes = await psList();
        const process = processes.find(process => processMatchesName(process, name));
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
        return processes.some(process => processMatchesName(process, name));
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
