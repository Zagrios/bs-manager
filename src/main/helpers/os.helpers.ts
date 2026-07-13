import cp from "child_process";
import { readFile } from "fs/promises";
import log from "electron-log";
import psList from "ps-list";
import { IS_FLATPAK } from "main/constants";
import { getWindowsProcessesByName } from "./windows-powershell.helper";

export const BSM_LAUNCH_TOKEN_ENV = "BSMANAGER_LAUNCH_TOKEN";
const FLATPAK_HOST_PROCESS_LIST_TIMEOUT_MS = 5_000;

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
    const launchToken = options?.options?.env?.[BSM_LAUNCH_TOKEN_ENV];
    const loggedCommand = typeof launchToken === "string" && launchToken.length > 0
        ? command.replaceAll(launchToken, "[REDACTED]")
        : command;

    if ((optionsLog & BsmShellLog.EnvVariables) > 0) {
        const loggedEnvironment = launchToken
            ? { ...options?.options?.env, [BSM_LAUNCH_TOKEN_ENV]: "[REDACTED]" }
            : options?.options?.env;
        log.info(platform, shell, "env", loggedEnvironment);
    }

    if ((optionsLog & BsmShellLog.Command) > 0) {
        log.info(platform, shell, "command\n>", loggedCommand);
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
    launchToken?: string;
    startMarker?: string;
    startTime?: Date | number | string;
};

type LinuxProcessMetadata = {
    processGroupId: number;
    startTime: Date;
};

async function getFlatpakHostProcessesByName(name: string): Promise<ProcessDetails[]> {
    const quoteShellArgument = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;
    const quotedName = quoteShellArgument(name);
    const hostScript = [
        "current_uid=$(id -u)",
        "for process_dir in /proc/[0-9]*; do",
        "[ \"$(stat -c %u \"$process_dir\" 2>/dev/null)\" = \"$current_uid\" ] || continue",
        `process_name=$(cat \"$process_dir/comm\" 2>/dev/null) || continue; [ \"$process_name\" = ${quotedName} ] || continue`,
        "pid=$(basename \"$process_dir\")",
        "metadata=$(env LC_ALL=C TZ=UTC /bin/ps -p \"$pid\" -o ppid=,pgid=,lstart= 2>/dev/null) || continue",
        "set -- $metadata; [ \"$#\" -eq 7 ] || continue",
        "command_base64=$(base64 < \"$process_dir/cmdline\" 2>/dev/null | tr -d '\\n') || continue",
        `token_base64=$(tr '\\0' '\\n' < \"$process_dir/environ\" 2>/dev/null | sed -n ${quoteShellArgument(`s/^${BSM_LAUNCH_TOKEN_ENV}=//p`)} | head -n 1 | tr -d '\\n' | base64 | tr -d '\\n')`,
        "printf '%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n' \"$pid\" \"$1\" \"$2\" \"$3\" \"$4\" \"$5\" \"$6\" \"$7\" \"$command_base64\" \"$token_base64\"",
        "done",
    ].join("\n");
    const { stdout } = await bsmExec(`sh -c ${quoteShellArgument(hostScript)}`, {
        log: BsmShellLog.Command,
        flatpak: { host: true },
        options: {
            maxBuffer: 4 * 1_024 * 1_024,
            timeout: FLATPAK_HOST_PROCESS_LIST_TIMEOUT_MS,
        },
    });

    return stdout.split("\n").flatMap(line => {
        const fields = line.split("\t");
        if (fields.length !== 10) { return []; }
        const pid = Number(fields[0]);
        const ppid = Number(fields[1]);
        const processGroupId = Number(fields[2]);
        const startedAt = new Date(`${fields.slice(3, 8).join(" ")} UTC`);
        const command = Buffer.from(fields[8], "base64").toString("utf8").replaceAll("\0", " ").trim();
        const launchToken = Buffer.from(fields[9], "base64").toString("utf8");
        if (!Number.isSafeInteger(pid) || pid <= 0
            || !Number.isSafeInteger(ppid)
            || !Number.isSafeInteger(processGroupId)
            || !Number.isFinite(startedAt.getTime())) {
            return [];
        }
        return [{
            pid,
            ppid,
            processGroupId,
            name,
            cmd: command || undefined,
            startTime: startedAt,
            ...(launchToken.length > 0 ? { launchToken } : {}),
        }];
    });
}

async function getLinuxProcessMetadata(processIds: number[]): Promise<Map<number, LinuxProcessMetadata>> {
    if (processIds.length === 0) {
        return new Map();
    }

    const stdout = await new Promise<string>((resolve, reject) => {
        cp.execFile(
            "/bin/ps",
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

export async function getProcessesByName(name: string, launchToken?: string): Promise<ProcessDetails[]> {
    if (!name) {
        return [];
    }
    if (process.platform === "win32") {
        return getWindowsProcessesByName(name);
    }
    if (IS_FLATPAK) {
        const processes = await getFlatpakHostProcessesByName(name);
        return launchToken
            ? processes.filter(processDetails => processDetails.launchToken === launchToken)
            : processes;
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
