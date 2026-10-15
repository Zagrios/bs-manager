import log from "electron-log";
import {
    createProcessTable,
    flatpakHostProcessTable,
    isProcessRunning,
    linuxProcessTable,
    ProcessTable,
    ProcessTableIo,
    win32ProcessTable,
} from "main/helpers/process-table";

jest.mock("electron", () => ({ app: { getPath: () => "" } }));
jest.mock("electron-log", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

type FakeIo = { [K in keyof ProcessTableIo]: jest.Mock };

function fakeIo(): FakeIo {
    return {
        exec: jest.fn().mockRejectedValue(new Error("unexpected exec")),
        execFile: jest.fn().mockRejectedValue(new Error("unexpected execFile")),
        psList: jest.fn().mockRejectedValue(new Error("unexpected psList")),
        readFile: jest.fn().mockRejectedValue(new Error("ENOENT")),
    };
}

const grepNoMatch = () => Object.assign(new Error("Command failed"), { code: 1 });

const originalSystemRoot = process.env.SystemRoot;

beforeEach(() => {
    jest.clearAllMocks();
    process.env.SystemRoot = "C:\\Windows";
});

afterAll(() => {
    if (originalSystemRoot === undefined) {
        delete process.env.SystemRoot;
    } else {
        process.env.SystemRoot = originalSystemRoot;
    }
});

describe("Windows process table", () => {
    it("lists a named process through shell-free PowerShell CIM with parent, path and start time", async () => {
        const io = fakeIo();
        io.execFile.mockResolvedValue(JSON.stringify([{
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "C:\\Beat Saber\\Beat Saber.exe",
            startTime: "2026-07-13T08:00:00.123Z",
        }, {
            pid: "not a pid",
            ppid: 42,
            name: "Beat Saber.exe",
        }]));

        const processes = await win32ProcessTable(io).list({ name: "Beat Saber.exe" });

        expect(processes).toEqual([{
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "C:\\Beat Saber\\Beat Saber.exe",
            startTime: new Date("2026-07-13T08:00:00.123Z"),
        }]);
        const [file, args, options] = io.execFile.mock.calls[0];
        expect(file).toBe("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
        expect(options).toEqual(expect.objectContaining({ shell: false, timeout: 2_000, windowsHide: true }));
        const script = Buffer.from(args[3], "base64").toString("utf16le");
        expect(script).toContain("Get-CimInstance Win32_Process");
        expect(script).toContain("$_.ExecutablePath");
        expect(script).toContain("$_.CreationDate.ToUniversalTime()");
        expect(script).toContain("[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)");
        expect(script).toContain(Buffer.from("Beat Saber.exe", "utf8").toString("base64"));
    });

    it("preserves a non-ASCII executable path from a single UTF-8 JSON object", async () => {
        const io = fakeIo();
        io.execFile.mockResolvedValue(JSON.stringify({
            pid: 85,
            ppid: 42,
            name: "Beat Saber.exe",
            cmd: "C:\\Jeux\\Béat Sàber\\Beat Saber.exe",
            startTime: "2026-07-13T08:00:00.123Z",
        }));

        await expect(win32ProcessTable(io).list({ name: "Beat Saber.exe" })).resolves.toEqual([
            expect.objectContaining({ cmd: "C:\\Jeux\\Béat Sàber\\Beat Saber.exe" }),
        ]);
    });

    it("rejects PowerShell failures and malformed JSON", async () => {
        const io = fakeIo();
        const enumerationError = new Error("PowerShell failed");
        io.execFile.mockRejectedValueOnce(enumerationError).mockResolvedValueOnce("not json");
        const table = win32ProcessTable(io);

        await expect(table.list({ name: "Beat Saber.exe" })).rejects.toBe(enumerationError);
        await expect(table.list({ name: "Beat Saber.exe" })).rejects.toBeInstanceOf(SyntaxError);
    });

    it("checks presence through ps-list on the process name or command line", async () => {
        const io = fakeIo();
        io.psList.mockResolvedValue([
            { pid: 10, ppid: 1, name: "steamwebhelper.exe" },
            { pid: 440, ppid: 1, name: "steam.exe" },
            { pid: 441, ppid: 1, name: "other.exe", cmd: "C:\\Steam\\steam.exe -silent" },
        ]);

        await expect(win32ProcessTable(io).list({ commandLine: "steam.exe" })).resolves.toEqual([
            { pid: 440, ppid: 1, name: "steam.exe", cmd: undefined },
            { pid: 441, ppid: 1, name: "other.exe", cmd: "C:\\Steam\\steam.exe -silent" },
        ]);
        expect(io.execFile).not.toHaveBeenCalled();
    });

    it("returns nothing for an empty query without running anything", async () => {
        const io = fakeIo();
        const table = win32ProcessTable(io);

        await expect(table.list({ name: "" })).resolves.toEqual([]);
        await expect(table.list({ commandLine: "" })).resolves.toEqual([]);
        expect(io.execFile).not.toHaveBeenCalled();
        expect(io.psList).not.toHaveBeenCalled();
    });
});

describe("Linux native process table", () => {
    const stat = (pid: number, comm: string, startTicks: string) => (
        `${pid} (${comm}) ${["S", ...Array(18).fill("0"), startTicks, "999"].join(" ")}`
    );

    it("enriches matching ps-list rows with /bin/ps metadata, ancestry and /proc start marker", async () => {
        const io = fakeIo();
        io.psList.mockResolvedValue([
            { pid: 1, ppid: 0, name: "systemd" },
            { pid: 42, ppid: 1, name: "bash", cmd: "bash -c proton run" },
            { pid: 60, ppid: 42, name: "wine", cmd: "wine-preloader" },
            { pid: 85, ppid: 60, name: "Beat Saber.exe", cmd: "Z:\\games\\Beat Saber\\Beat Saber.exe fpfc" },
        ]);
        io.execFile.mockResolvedValue("   85    42 Mon Jul 13 08:00:01 2026\n");
        io.readFile.mockResolvedValue(stat(85, "Beat Saber.exe", "12345"));

        const processes = await linuxProcessTable(io).list({ name: "Beat Saber.exe", launchToken: "ignored" });

        expect(processes).toEqual([{
            pid: 85,
            ppid: 60,
            name: "Beat Saber.exe",
            cmd: "Z:\\games\\Beat Saber\\Beat Saber.exe fpfc",
            processGroupId: 42,
            startTime: new Date("Mon Jul 13 08:00:01 2026"),
            ancestorPids: [60, 42, 1],
            startMarker: "12345",
        }]);
        expect(io.execFile).toHaveBeenCalledWith(
            "/bin/ps",
            ["-o", "pid=,pgid=,lstart=", "-p", "85"],
            { env: expect.objectContaining({ LC_ALL: "C" }) }
        );
        expect(io.readFile).toHaveBeenCalledWith("/proc/85/stat");
        expect(io.exec).not.toHaveBeenCalled();
    });

    it("keeps substring matches on the name or command line, like the ARM64 Steam lookup expects", async () => {
        const io = fakeIo();
        io.psList.mockResolvedValue([
            { pid: 430, ppid: 1, name: "steamwebhelper", cmd: "/steam/steamrtarm64/steamwebhelper" },
            { pid: 420, ppid: 1, name: "steam", cmd: "/steam/steamrtarm64/steam -silent" },
        ]);
        io.execFile.mockResolvedValue("");

        const processes = await linuxProcessTable(io).list({ name: "steam" });

        expect(processes.map(processDetails => processDetails.pid)).toEqual([430, 420]);
    });

    it("checks presence with ps and grep, skipping grep itself", async () => {
        const io = fakeIo();
        io.exec.mockResolvedValue([
            "  410 /home/player/.steam/steam/ubuntu12_32/steam-runtime-launcher-service --alongside-steam",
            "  999 grep steam-runtime-launcher-service",
            "",
        ].join("\n"));

        const processes = await linuxProcessTable(io).list({ commandLine: "steam-runtime-launcher-service" });

        expect(io.exec).toHaveBeenCalledWith(
            "ps awwxo pid,args | grep \"[s]team-runtime-launcher-service\"",
            { host: false }
        );
        expect(processes).toEqual([{
            pid: 410,
            cmd: "/home/player/.steam/steam/ubuntu12_32/steam-runtime-launcher-service --alongside-steam",
        }]);
    });

    it("treats grep's no-match status as an empty table and rejects real failures", async () => {
        const io = fakeIo();
        const failure = Object.assign(new Error("ps failed"), { code: 2 });
        io.exec.mockRejectedValueOnce(grepNoMatch()).mockRejectedValueOnce(failure);
        const table = linuxProcessTable(io);

        await expect(table.list({ commandLine: "steam" })).resolves.toEqual([]);
        await expect(table.list({ commandLine: "steam" })).rejects.toBe(failure);
    });
});

describe("Flatpak host process table", () => {
    const hostRecord = (pid: number, token: string, command: string) => [
        pid, 60, 60, "Mon", "Jul", 13, "08:00:01", 2026,
        Buffer.from(command).toString("base64"),
        Buffer.from(token).toString("base64"),
    ].join("\t");

    it("reads the launch token only from the authoritative same-user host environment", async () => {
        const io = fakeIo();
        io.exec.mockResolvedValue([
            hostRecord(85, "owned-token", "wine /games/Beat Saber/Beat Saber.exe fpfc"),
            hostRecord(86, "", "wine /games/Beat Saber/Beat Saber.exe fpfc BSMANAGER_LAUNCH_TOKEN=argv-only-token"),
            "malformed\trow",
        ].join("\n"));
        const table = flatpakHostProcessTable(io);

        const processes = await table.list({ name: "Beat Saber.exe" });

        const [command, options] = io.exec.mock.calls[0];
        expect(options).toEqual({ host: true, maxBuffer: 4 * 1_024 * 1_024, timeout: 5_000 });
        expect(command).toMatch(/^sh -c '/);
        expect(command).toContain("/proc/");
        expect(command).toContain("/environ");
        expect(command).toContain("stat -c %u");
        expect(command).toContain("id -u");
        expect(command).toContain("/bin/ps");
        expect(command).toContain("BSMANAGER_LAUNCH_TOKEN=");
        expect(command).not.toContain("ps eww");
        expect(io.psList).not.toHaveBeenCalled();
        expect(processes).toEqual([{
            pid: 85,
            ppid: 60,
            processGroupId: 60,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc",
            startTime: new Date("2026-07-13T08:00:01.000Z"),
            launchToken: "owned-token",
        }, {
            pid: 86,
            ppid: 60,
            processGroupId: 60,
            name: "Beat Saber.exe",
            cmd: "wine /games/Beat Saber/Beat Saber.exe fpfc BSMANAGER_LAUNCH_TOKEN=argv-only-token",
            startTime: new Date("2026-07-13T08:00:01.000Z"),
        }]);

        await expect(table.list({ name: "Beat Saber.exe", launchToken: "argv-only-token" })).resolves.toEqual([]);
        await expect(table.list({ name: "Beat Saber.exe", launchToken: "owned-token" })).resolves.toEqual([
            expect.objectContaining({ pid: 85 }),
        ]);
    });

    it("checks presence with ps and grep on the host", async () => {
        const io = fakeIo();
        io.exec.mockResolvedValue("  410 steam-runtime-launcher-service\n");

        await flatpakHostProcessTable(io).list({ commandLine: "steam-runtime-launcher-service" });

        expect(io.exec).toHaveBeenCalledWith(
            "ps awwxo pid,args | grep \"[s]team-runtime-launcher-service\"",
            { host: true }
        );
    });
});

describe("Process table selection and presence checks", () => {
    it.each<[string, { platform: NodeJS.Platform; flatpak: boolean }, keyof ProcessTableIo]>([
        ["Windows", { platform: "win32", flatpak: false }, "execFile"],
        ["Linux", { platform: "linux", flatpak: false }, "psList"],
        ["Flatpak", { platform: "linux", flatpak: true }, "exec"],
    ])("lists named processes with the %s adapter", async (_label, environment, primitive) => {
        const io = fakeIo();
        io[primitive].mockResolvedValue(primitive === "psList" ? [] : "");

        await createProcessTable(environment, io).list({ name: "Beat Saber.exe" });

        expect(io[primitive]).toHaveBeenCalledTimes(1);
    });

    it("reports a process as running when the table has a match", async () => {
        const table: ProcessTable = { list: jest.fn().mockResolvedValue([{ pid: 1 }]) };

        await expect(isProcessRunning("OculusClient", table)).resolves.toBe(true);
        expect(table.list).toHaveBeenCalledWith({ commandLine: "OculusClient" });
    });

    it("logs an unreadable table and reports nothing running", async () => {
        const failure = new Error("ps failed");
        const table: ProcessTable = { list: jest.fn().mockRejectedValue(failure) };

        await expect(isProcessRunning("OculusClient", table)).resolves.toBe(false);
        expect(log.error).toHaveBeenCalledWith(failure);
    });

    it("does not query the table for an empty name", async () => {
        const table: ProcessTable = { list: jest.fn() };

        await expect(isProcessRunning("", table)).resolves.toBe(false);
        expect(table.list).not.toHaveBeenCalled();
    });
});
