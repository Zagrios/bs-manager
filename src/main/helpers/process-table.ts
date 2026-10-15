import cp from "node:child_process";
import { readFile } from "node:fs/promises";
import log from "electron-log";
import psList from "ps-list";
import { IS_FLATPAK } from "main/constants";
import { BSM_LAUNCH_TOKEN_ENV, BsmShellLog, bsmExec } from "./os.helpers";
import { buildWindowsPowerShellArgs, getWindowsPowerShellPath } from "./windows-powershell.helper";

export type ProcessInfo = {
    pid: number;
    ppid?: number;
    name?: string;
    cmd?: string;
    startTime?: Date;
    processGroupId?: number;
    ancestorPids?: number[];
    startMarker?: string;
    launchToken?: string;
};

export type ProcessQuery =
    | { name: string; launchToken?: string }
    | { commandLine: string };

export interface ProcessTable {
    list(query: ProcessQuery): Promise<ProcessInfo[]>;
}

export type ProcessTableIo = {
    exec(command: string, options: { host: boolean; timeout?: number; maxBuffer?: number }): Promise<string>;
    execFile(file: string, args: string[], options: cp.ExecFileOptions): Promise<string>;
    psList(): Promise<psList.ProcessDescriptor[]>;
    readFile(filePath: string): Promise<string>;
};

const FLATPAK_HOST_PROCESS_LIST_TIMEOUT_MS = 5_000;
const WINDOWS_PROCESS_LIST_TIMEOUT_MS = 2_000;
const SHELL_SINGLE_QUOTE_ESCAPE = `'"'"'`;

const WINDOWS_PROCESS_LIST_SCRIPT = `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$escapedProcessName = $TargetProcessName.Replace("'", "''")
$processes = @(Get-CimInstance Win32_Process -Filter "Name = '$escapedProcessName'" -ErrorAction Stop |
    ForEach-Object {
        $startedAt = $null
        try {
            $startedAt = $_.CreationDate.ToUniversalTime().ToString("o")
        }
        catch {
        }

        [PSCustomObject]@{
            pid = [int]$_.ProcessId
            ppid = [int]$_.ParentProcessId
            name = $_.Name
            cmd = $_.ExecutablePath
            startTime = $startedAt
        }
    })

ConvertTo-Json -InputObject $processes -Compress
`;

export const defaultProcessTableIo: ProcessTableIo = {
    exec: async (command, { host, timeout, maxBuffer }) => {
        const options: cp.ExecOptions = {};
        if (timeout !== undefined) { options.timeout = timeout; }
        if (maxBuffer !== undefined) { options.maxBuffer = maxBuffer; }
        const { stdout } = await bsmExec(command, {
            log: BsmShellLog.Command,
            flatpak: { host },
            options,
        });
        return stdout;
    },
    execFile: (file, args, options) => new Promise((resolve, reject) => {
        cp.execFile(file, args, { ...options, encoding: "utf8" }, (error, stdout) => {
            if (error) { return reject(error); }
            resolve(stdout);
        });
    }),
    psList: () => psList(),
    readFile: filePath => readFile(filePath, "utf8"),
};

const toDate = (value: unknown): Date | undefined => {
    if (value === undefined || value === null) { return undefined; }
    const date = value instanceof Date ? value : new Date(value as string);
    return Number.isFinite(date.getTime()) ? date : undefined;
};

const processMatchesName = (process: psList.ProcessDescriptor, name: string) =>
    process.name?.includes(name) || process.cmd?.includes(name);

const transformProcessNameForPS = (name: string) => `[${name.at(0)}]${name.substring(1)}`;

async function listLinuxCommandLines(io: ProcessTableIo, text: string, host: boolean): Promise<ProcessInfo[]> {
    let stdout: string;
    try {
        stdout = await io.exec(`ps awwxo pid,args | grep "${transformProcessNameForPS(text)}"`, { host });
    } catch (error) {
        if ((error as { code?: unknown })?.code === 1) {
            return [];
        }
        throw error;
    }

    return stdout.split("\n")
        .map(line => line.trimStart())
        .filter(line => line.includes(text) && !line.includes("grep"))
        .map(line => {
            const separator = line.indexOf(" ");
            return { pid: +line.substring(0, separator), cmd: line.substring(separator + 1) };
        });
}

async function listWindowsProcessesByName(io: ProcessTableIo, name: string): Promise<ProcessInfo[]> {
    const encodedProcessName = Buffer.from(name, "utf8").toString("base64");
    const script = `$TargetProcessName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedProcessName}'))\n${WINDOWS_PROCESS_LIST_SCRIPT}`;
    const stdout = await io.execFile(getWindowsPowerShellPath(), buildWindowsPowerShellArgs(script), {
        maxBuffer: 1_000_000,
        shell: false,
        timeout: WINDOWS_PROCESS_LIST_TIMEOUT_MS,
        windowsHide: true,
    });

    const output = stdout.trim();
    const parsed = output ? JSON.parse(output) : [];
    const processes = Array.isArray(parsed) ? parsed : [parsed];
    return processes.flatMap(processDetails => {
        const pid = Number(processDetails?.pid);
        const ppid = Number(processDetails?.ppid);
        if (!Number.isSafeInteger(pid) || pid <= 0 || !Number.isSafeInteger(ppid) || typeof processDetails?.name !== "string") {
            return [];
        }
        const startTime = typeof processDetails.startTime === "string" ? toDate(processDetails.startTime) : undefined;
        return [{
            pid,
            ppid,
            name: processDetails.name,
            cmd: typeof processDetails.cmd === "string" ? processDetails.cmd : undefined,
            ...(startTime ? { startTime } : {}),
        }];
    });
}

async function listFlatpakHostProcessesByName(io: ProcessTableIo, name: string): Promise<ProcessInfo[]> {
    const quoteShellArgument = (value: string) => `'${value.replaceAll("'", SHELL_SINGLE_QUOTE_ESCAPE)}'`;
    const quotedName = quoteShellArgument(name);
    const launchTokenExpression = quoteShellArgument(`s/^${BSM_LAUNCH_TOKEN_ENV}=//p`);
    const hostScript = [
        "current_uid=$(id -u)",
        "for process_dir in /proc/[0-9]*; do",
        `[ "$(stat -c %u "$process_dir" 2>/dev/null)" = "$current_uid" ] || continue`,
        `process_name=$(cat "$process_dir/comm" 2>/dev/null) || continue; [ "$process_name" = ${quotedName} ] || continue`,
        `pid=$(basename "$process_dir")`,
        `metadata=$(env LC_ALL=C TZ=UTC /bin/ps -p "$pid" -o ppid=,pgid=,lstart= 2>/dev/null) || continue`,
        `set -- $metadata; [ "$#" -eq 7 ] || continue`,
        String.raw`command_base64=$(base64 < "$process_dir/cmdline" 2>/dev/null | tr -d '\n') || continue`,
        String.raw`token_base64=$(tr '\0' '\n' < "$process_dir/environ" 2>/dev/null | sed -n ${launchTokenExpression} | head -n 1 | tr -d '\n' | base64 | tr -d '\n')`,
        String.raw`printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$pid" "$1" "$2" "$3" "$4" "$5" "$6" "$7" "$command_base64" "$token_base64"`,
        "done",
    ].join("\n");
    const stdout = await io.exec(`sh -c ${quoteShellArgument(hostScript)}`, {
        host: true,
        maxBuffer: 4 * 1_024 * 1_024,
        timeout: FLATPAK_HOST_PROCESS_LIST_TIMEOUT_MS,
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

type LinuxProcessMetadata = {
    processGroupId: number;
    startTime: Date;
};

async function getLinuxProcessMetadata(io: ProcessTableIo, processIds: number[]): Promise<Map<number, LinuxProcessMetadata>> {
    if (processIds.length === 0) {
        return new Map();
    }

    const stdout = await io.execFile(
        "/bin/ps",
        ["-o", "pid=,pgid=,lstart=", "-p", processIds.join(",")],
        { env: { ...process.env, LC_ALL: "C" } }
    );
    const metadata = new Map<number, LinuxProcessMetadata>();
    const isUnsignedInteger = (value: string) => value.length > 0
        && Array.from(value).every(character => character >= "0" && character <= "9");
    for (const line of stdout.split("\n")) {
        const fields = line.trim().split(/\s+/);
        if (fields.length < 3) { continue; }
        const [processIdField, processGroupIdField, ...startTimeFields] = fields;
        if (!isUnsignedInteger(processIdField) || !isUnsignedInteger(processGroupIdField)) { continue; }
        const processId = Number(processIdField);
        const processGroupId = Number(processGroupIdField);
        const startTime = new Date(startTimeFields.join(" "));
        if (Number.isSafeInteger(processId) && Number.isSafeInteger(processGroupId)
            && Number.isFinite(startTime.getTime())) {
            metadata.set(processId, { processGroupId, startTime });
        }
    }
    return metadata;
}

async function getLinuxProcessStartMarker(io: ProcessTableIo, processId: number): Promise<string | undefined> {
    try {
        const stat = await io.readFile(`/proc/${processId}/stat`);
        const fieldsAfterName = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
        return fieldsAfterName[19];
    } catch {
        return undefined;
    }
}

function getAncestorPids(
    processId: number,
    processesById: Map<number, psList.ProcessDescriptor>
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

async function listLinuxProcessesByName(io: ProcessTableIo, name: string): Promise<ProcessInfo[]> {
    const processes = await io.psList();
    const matchingProcesses = processes.filter(process => processMatchesName(process, name));
    const metadata = await getLinuxProcessMetadata(io, matchingProcesses.map(process => process.pid));
    const processesById = new Map(processes.map(process => [process.pid, process]));
    return Promise.all(matchingProcesses.map(async processDetails => ({
        pid: processDetails.pid,
        ppid: processDetails.ppid,
        name: processDetails.name,
        cmd: processDetails.cmd,
        ...metadata.get(processDetails.pid),
        ancestorPids: getAncestorPids(processDetails.pid, processesById),
        startMarker: await getLinuxProcessStartMarker(io, processDetails.pid),
    })));
}

const isNameQuery = (query: ProcessQuery): query is { name: string; launchToken?: string } => "name" in query;

export function win32ProcessTable(io: ProcessTableIo = defaultProcessTableIo): ProcessTable {
    return {
        async list(query) {
            if (isNameQuery(query)) {
                return query.name ? listWindowsProcessesByName(io, query.name) : [];
            }
            if (!query.commandLine) { return []; }
            const processes = await io.psList();
            return processes
                .filter(process => processMatchesName(process, query.commandLine))
                .map(({ pid, ppid, name, cmd }) => ({ pid, ppid, name, cmd }));
        },
    };
}

export function linuxProcessTable(io: ProcessTableIo = defaultProcessTableIo): ProcessTable {
    return {
        async list(query) {
            if (isNameQuery(query)) {
                return query.name ? listLinuxProcessesByName(io, query.name) : [];
            }
            return query.commandLine ? listLinuxCommandLines(io, query.commandLine, false) : [];
        },
    };
}

export function flatpakHostProcessTable(io: ProcessTableIo = defaultProcessTableIo): ProcessTable {
    return {
        async list(query) {
            if (!isNameQuery(query)) {
                return query.commandLine ? listLinuxCommandLines(io, query.commandLine, true) : [];
            }
            if (!query.name) { return []; }
            const processes = await listFlatpakHostProcessesByName(io, query.name);
            return query.launchToken
                ? processes.filter(processDetails => processDetails.launchToken === query.launchToken)
                : processes;
        },
    };
}

export function createProcessTable(
    environment: { platform: NodeJS.Platform; flatpak: boolean },
    io: ProcessTableIo = defaultProcessTableIo
): ProcessTable {
    if (environment.platform === "win32") {
        return win32ProcessTable(io);
    }
    return environment.flatpak ? flatpakHostProcessTable(io) : linuxProcessTable(io);
}

let defaultTable: ProcessTable | undefined;

export function defaultProcessTable(): ProcessTable {
    defaultTable ??= createProcessTable({ platform: process.platform, flatpak: IS_FLATPAK });
    return defaultTable;
}

export async function isProcessRunning(name: string, processes: ProcessTable = defaultProcessTable()): Promise<boolean> {
    if (!name) {
        return false;
    }
    try {
        return (await processes.list({ commandLine: name })).length > 0;
    } catch (error) {
        log.error(error);
        return false;
    }
}
