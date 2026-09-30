import type { SteamService } from "main/services/steam.service";

let mockIsFlatpak = false;

jest.mock("electron", () => ({
    app: { getPath: () => "" },
    shell: { openExternal: jest.fn() },
}));
jest.mock("electron-log", () => ({
    info: jest.fn(),
    error: jest.fn(),
}));
jest.mock("main/constants", () => ({ IS_FLATPAK: mockIsFlatpak }));
jest.mock("node:child_process", () => ({
    ...jest.requireActual("node:child_process"),
    exec: jest.fn(),
    execFile: jest.fn(),
}));
jest.mock("ps-list", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("query-process", () => ({ isElevated: jest.fn() }));
jest.mock("regedit-rs", () => ({ list: jest.fn() }));

type ProcessFixture = {
    pid: number;
    name: string;
    cmd: string;
};

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
const originalArchDescriptor = Object.getOwnPropertyDescriptor(process, "arch");
const activeProcessKey = "HKCU\\Software\\Valve\\Steam\\ActiveProcess";

const linuxRuntime: ProcessFixture = {
    pid: 410,
    name: "steam-runtime-launcher-service",
    cmd: "/home/player/.steam/steam/ubuntu12_32/steam-runtime-launcher-service --alongside-steam",
};
const armSteam: ProcessFixture = {
    pid: 420,
    name: "steam",
    cmd: "/home/player/.steam/steam/steamrtarm64/steam -silent",
};
const armWebHelper: ProcessFixture = {
    pid: 430,
    name: "steamwebhelper",
    cmd: "/home/player/.steam/steam/steamrtarm64/steamwebhelper --type=utility",
};
const armWebHelperWithClientArgument: ProcessFixture = {
    ...armWebHelper,
    cmd: "/home/player/.steam/steam/steamrtarm64/steamwebhelper -steampath=/home/player/.steam/steam/steamrtarm64/steam --type=utility",
};
const windowsSteam: ProcessFixture = {
    pid: 440,
    name: "steam.exe",
    cmd: '"C:\\Program Files (x86)\\Steam\\steam.exe" -silent',
};

function loadService(platform: NodeJS.Platform, arch: string, processes: ProcessFixture[], flatpak = false) {
    Object.defineProperty(process, "platform", { configurable: true, value: platform });
    Object.defineProperty(process, "arch", { configurable: true, value: arch });
    mockIsFlatpak = flatpak;

    let service: SteamService;
    let registryList: jest.Mock;
    let processList: jest.Mock;
    jest.isolateModules(() => {
        const childProcess = require("node:child_process") as typeof import("node:child_process");
        const { default: psList } = require("ps-list") as { default: jest.Mock };
        registryList = (require("regedit-rs") as { list: jest.Mock }).list;

        // Keep the real OS helpers: emulate the ps/grep boundary using command
        // line fixtures, including grep's exit status when nothing matches.
        (childProcess.exec as unknown as jest.Mock).mockImplementation((
            command: string,
            _options: unknown,
            callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
            if (command.startsWith("flatpak-spawn --host") && command.includes("/proc/")) {
                const hostOutput = processes.filter(entry => entry.name === "steam").map(entry => [
                    entry.pid, 60, 60, "Wed", "Sep", 30, "12:00:00", 2026,
                    Buffer.from(entry.cmd).toString("base64"), "",
                ].join("\t")).join("\n");
                callback(null, hostOutput, "");
                return {};
            }
            const pattern = /grep(?: -c)? "([^"]+)"/.exec(command)?.[1];
            if (!pattern) {
                throw new Error(`Unexpected process discovery command: ${command}`);
            }
            const matcher = new RegExp(pattern);
            const matches = processes.filter(entry => matcher.test(entry.cmd));
            const stdout = command.includes("grep -c ")
                ? `${matches.length}\n`
                : matches.map(entry => `  ${entry.pid} ${entry.cmd}`).join("\n");
            callback(matches.length ? null : new Error("grep found no process"), stdout, "");
            return {};
        });
        (childProcess.execFile as unknown as jest.Mock).mockImplementation((
            _executable: string,
            _arguments: string[],
            _options: unknown,
            callback: (error: Error | null, stdout: string) => void
        ) => {
            callback(null, processes.map(entry => `${entry.pid} ${entry.pid} Wed Sep 30 12:00:00 2026`).join("\n"));
            return {};
        });
        psList.mockResolvedValue(processes);
        processList = psList;
        registryList.mockResolvedValue({
            [activeProcessKey]: { exists: true, values: { ActiveUser: { value: 12345 } } },
        });

        const { SteamService: Service } = require("main/services/steam.service") as typeof import("main/services/steam.service");
        service = Service.getInstance();
    });

    return { service: service!, registryList: registryList!, processList: processList! };
}

afterEach(() => {
    Object.defineProperty(process, "platform", originalPlatformDescriptor!);
    Object.defineProperty(process, "arch", originalArchDescriptor!);
    mockIsFlatpak = false;
    jest.clearAllMocks();
});

describe.each(["x64", "ia32"])("Steam process discovery on Linux %s", arch => {
    it("detects the runtime launcher and returns its PID without requiring an active-user registry", async () => {
        const { service, registryList } = loadService("linux", arch, [armWebHelper, linuxRuntime]);

        await expect(service.isSteamRunning()).resolves.toBe(true);
        await expect(service.getSteamPid()).resolves.toBe(linuxRuntime.pid);
        expect(registryList).not.toHaveBeenCalled();
    });

    it("reports no Steam process when only an ARM64 client is present", async () => {
        const { service } = loadService("linux", arch, [armSteam, armWebHelper]);

        await expect(service.isSteamRunning()).resolves.toBe(false);
        await expect(service.getSteamPid()).resolves.toBeNull();
    });
});

describe("Steam process discovery on Linux ARM64", () => {
    it("detects the ARM64 client and returns its PID when a web helper appears first", async () => {
        const { service, registryList } = loadService("linux", "arm64", [armWebHelper, armSteam]);

        await expect(service.isSteamRunning()).resolves.toBe(true);
        await expect(service.getSteamPid()).resolves.toBe(armSteam.pid);
        expect(registryList).not.toHaveBeenCalled();
    });

    it("does not mistake steamwebhelper for the Steam client", async () => {
        const { service } = loadService("linux", "arm64", [armWebHelper]);

        await expect(service.isSteamRunning()).resolves.toBe(false);
        await expect(service.getSteamPid()).resolves.toBeNull();
    });

    it("detects the ARM64 client when its command line has no arguments", async () => {
        const clientWithoutArguments = { ...armSteam, cmd: "/home/player/.steam/steam/steamrtarm64/steam" };
        const { service } = loadService("linux", "arm64", [clientWithoutArguments]);

        await expect(service.isSteamRunning()).resolves.toBe(true);
        await expect(service.getSteamPid()).resolves.toBe(armSteam.pid);
    });

    it("does not mistake a Steam executable path in helper arguments for the client process", async () => {
        const { service } = loadService("linux", "arm64", [armWebHelperWithClientArgument]);

        await expect(service.isSteamRunning()).resolves.toBe(false);
        await expect(service.getSteamPid()).resolves.toBeNull();
    });

    it("finds the client PID when a helper mentioning its executable appears first", async () => {
        const { service } = loadService("linux", "arm64", [armWebHelperWithClientArgument, armSteam]);

        await expect(service.isSteamRunning()).resolves.toBe(true);
        await expect(service.getSteamPid()).resolves.toBe(armSteam.pid);
    });

    it("reports no Steam process when neither the ARM64 client nor its helper is present", async () => {
        const { service } = loadService("linux", "arm64", []);

        await expect(service.isSteamRunning()).resolves.toBe(false);
        await expect(service.getSteamPid()).resolves.toBeNull();
    });

    it("returns unavailable and no PID when process enumeration fails", async () => {
        const { service, processList } = loadService("linux", "arm64", [armSteam]);
        processList.mockRejectedValue(new Error("process enumeration unavailable"));

        await expect(service.isSteamRunning()).resolves.toBe(false);
        await expect(service.getSteamPid()).resolves.toBeNull();
    });

    it("detects the host client without arguments inside Flatpak", async () => {
        const clientWithoutArguments = { ...armSteam, cmd: "/home/player/.steam/steam/steamrtarm64/steam" };
        const { service, processList } = loadService("linux", "arm64", [armWebHelperWithClientArgument, clientWithoutArguments], true);

        await expect(service.isSteamRunning()).resolves.toBe(true);
        await expect(service.getSteamPid()).resolves.toBe(armSteam.pid);
        expect(processList).not.toHaveBeenCalled();
    });

    it("does not mistake a host helper mentioning Steam for the client inside Flatpak", async () => {
        const { service, processList } = loadService("linux", "arm64", [armWebHelperWithClientArgument], true);

        await expect(service.isSteamRunning()).resolves.toBe(false);
        await expect(service.getSteamPid()).resolves.toBeNull();
        expect(processList).not.toHaveBeenCalled();
    });
});

describe("Steam process discovery on Windows", () => {
    it.each(["x64", "arm64"])("keeps steam.exe detection and active-user validation on %s", async arch => {
        const { service, registryList } = loadService("win32", arch, [windowsSteam]);

        await expect(service.isSteamRunning()).resolves.toBe(true);
        await expect(service.getSteamPid()).resolves.toBe(windowsSteam.pid);
        expect(registryList).toHaveBeenCalledWith(activeProcessKey);
    });

    it("keeps a running client without an active user unavailable while retaining its PID", async () => {
        const { service, registryList } = loadService("win32", "x64", [windowsSteam]);
        registryList.mockResolvedValue({
            [activeProcessKey]: { exists: true, values: { ActiveUser: { value: 0 } } },
        });

        await expect(service.isSteamRunning()).resolves.toBe(false);
        await expect(service.getSteamPid()).resolves.toBe(windowsSteam.pid);
    });

    it("keeps the existing fallback when reading the active-user registry fails", async () => {
        const { service, registryList } = loadService("win32", "x64", [windowsSteam]);
        registryList.mockRejectedValue(new Error("registry unavailable"));

        await expect(service.isSteamRunning()).resolves.toBe(false);
        await expect(service.getSteamPid()).resolves.toBe(windowsSteam.pid);
    });

    it("requires steam.exe even when the registry contains an active user", async () => {
        const { service } = loadService("win32", "x64", [armSteam, armWebHelper]);

        await expect(service.isSteamRunning()).resolves.toBe(false);
        await expect(service.getSteamPid()).resolves.toBeUndefined();
    });
});
