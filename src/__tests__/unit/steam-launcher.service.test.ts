import { pathExists } from "fs-extra";
import { lastValueFrom } from "rxjs";
import { SteamLauncherService } from "main/services/bs-launcher/steam-launcher.service";
import { LaunchOption } from "shared/models/bs-launch";
import { exec } from "child_process";
import { EventEmitter } from "events";
import { isProcessRunning } from "main/helpers/os.helpers";

jest.mock("child_process", () => ({
    ...jest.requireActual("child_process"),
    exec: jest.fn(),
}));

jest.mock("electron", () => ({
    app: {
        getPath: jest.fn(() => ""),
        on: jest.fn(),
        removeListener: jest.fn(),
        quit: jest.fn(),
    },
}));

jest.mock("electron-log", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock("fs-extra", () => ({
    pathExists: jest.fn(),
    rename: jest.fn(),
}));

jest.mock("main/constants", () => ({
    BS_APP_ID: "620980",
    BS_EXECUTABLE: "Beat Saber.exe",
    STEAMVR_APP_ID: "250820",
    IS_FLATPAK: false,
}));

jest.mock("main/services/steam.service", () => ({
    SteamService: { getInstance: jest.fn(() => ({})) },
}));

jest.mock("main/services/utils.service", () => ({
    UtilsService: { getInstance: jest.fn(() => ({})) },
}));

jest.mock("main/services/linux.service", () => ({
    LinuxService: { getInstance: jest.fn(() => ({})) },
}));

jest.mock("main/services/bs-local-version.service", () => ({
    BSLocalVersionService: { getInstance: jest.fn(() => ({})) },
}));

jest.mock("main/helpers/os.helpers", () => ({
    BsmShellLog: { Command: 1 },
    bsmSpawn: jest.fn(),
    isProcessRunning: jest.fn(),
}));

jest.mock("main/helpers/launchOptions.helper", () => ({
    parseLaunchOptions: jest.fn(() => ({
        env: {},
        cmdlet: "Beat Saber.exe",
        args: "",
    })),
}));

describe("SteamLauncherService legacy launch options", () => {
    function buildService() {
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        const steam = {
            isSteamRunning: jest.fn(async () => false),
            openSteam: jest.fn(async (): Promise<void> => undefined),
            getSteamPath: jest.fn(async () => "C:/Steam"),
        };

        (service as any).steam = steam;
        (service as any).localVersions = {
            getInstalledVersionPath: jest.fn(async () => "C:/Beat Saber"),
        };
        (service as any).linux = {
            buildEnvVariables: jest.fn(async () => ({})),
            getProtonPrefix: jest.fn(async () => "proton"),
        };
        (service as any).restoreSteamVR = jest.fn(async (): Promise<void> => undefined);
        (service as any).launchBeatSaber = jest.fn(() => ({
            process: {},
            exit: Promise.resolve(0),
        }));

        return { service, steam };
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (pathExists as jest.Mock).mockResolvedValue(true);
    });

    it("does not open Steam for a legacy skip_steam launch option", async () => {
        const { service, steam } = buildService();
        const launchOptions: LaunchOption = {
            version: {
                BSVersion: "1.29.1",
                steam: true,
            },
            launchMods: ["skip_steam"] as LaunchOption["launchMods"],
        };

        await lastValueFrom(service.launch(launchOptions));

        expect(steam.isSteamRunning).not.toHaveBeenCalled();
        expect(steam.openSteam).not.toHaveBeenCalled();
    });
});

describe("SteamLauncherService administrator lifecycle", () => {
    it("waits for the elevated helper to report Beat Saber exit", async () => {
        jest.useFakeTimers();
        const adminProcess = Object.assign(new EventEmitter(), {
            killed: false,
            pid: 84,
            unref: jest.fn(),
        });
        (exec as unknown as jest.Mock).mockReturnValue(adminProcess);
        (isProcessRunning as jest.Mock).mockResolvedValue(true);
        const service = Object.create(SteamLauncherService.prototype) as SteamLauncherService;
        Object.assign(service as any, {
            util: { getAssetsScriptsPath: jest.fn(() => "C:/assets/scripts") },
            restoreSteamVR: jest.fn().mockResolvedValue(undefined),
        });

        let settled = false;
        const exit = (service as any).launchBeatSaberAsAdmin("C:/Beat Saber/Beat Saber.exe", [], {})
            .then((code: number) => {
                settled = true;
                return code;
            });

        jest.advanceTimersByTime(35_000);
        await Promise.resolve();
        expect(settled).toBe(false);

        adminProcess.emit("exit", 0);
        await Promise.resolve();
        await Promise.resolve();
        expect(settled).toBe(false);

        (isProcessRunning as jest.Mock).mockResolvedValue(false);
        await jest.advanceTimersByTimeAsync(1_000);
        await expect(exit).resolves.toBe(0);
        jest.useRealTimers();
    });
});
