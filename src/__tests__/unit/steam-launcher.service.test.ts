import { pathExists } from "fs-extra";
import { lastValueFrom } from "rxjs";
import { SteamLauncherService } from "main/services/bs-launcher/steam-launcher.service";
import { LaunchOption } from "shared/models/bs-launch";

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
