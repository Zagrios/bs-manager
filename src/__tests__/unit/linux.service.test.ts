import fs from "fs-extra";
import path from "path";
import { LinuxService } from "main/services/linux.service";
import { BS_APP_ID } from "main/constants";
import { LaunchMod, LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { LaunchOption } from "shared/models/bs-launch";
import { bsmExec } from "main/helpers/os.helpers";

jest.mock("electron", () => ({
    app: { getPath: () => "" },
}));

jest.mock("electron-log", () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
}));

jest.mock("main/services/installation-location.service", () => ({
    InstallationLocationService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/static-configuration.service", () => ({
    StaticConfigurationService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/helpers/os.helpers", () => ({
    BsmShellLog: { Command: 1 },
    bsmExec: jest.fn(),
}));
jest.mock("main/services/bs-launcher/abstract-launcher.service", () => ({
    buildBsLaunchArgs: jest.fn((): string[] => []),
}));
jest.mock("main/helpers/launchOptions.helper", () => ({
    parseLaunchOptions: jest.fn(() => ({ env: {}, cmdlet: "", args: "" })),
}));

jest.mock("fs-extra", () => ({
    __esModule: true,
    default: {
        existsSync: jest.fn(() => true),
        ensureDir: jest.fn(),
        pathExistsSync: jest.fn(() => true),
        writeFile: jest.fn(),
    },
}));

describe("LinuxService.buildEnvVariables", () => {
    const steamPath = "/steam";
    const bsFolderPath = "/BSInstance";
    const sharedContentPath = "/shared-content";
    const compatDataPath = path.resolve(sharedContentPath, "compatdata");

    function buildService(): LinuxService {
        const service = Object.create(LinuxService.prototype) as LinuxService;

        (service as any).installLocationService = {
            sharedContentPath: () => sharedContentPath,
        };
        (service as any).staticConfig = {
            has: jest.fn(() => true),
            get: jest.fn(() => "/proton"),
        };
        (service as any).nixOS = false;
        (service as any).getProtonPath = jest.fn(async () => "/proton/proton");
        (service as any).getProtonPrefix = jest.fn(async () => '"/proton/proton" run');

        return service;
    }

    function buildLaunchOption(launchMods: LaunchMod[] = []): LaunchOption {
        return {
            version: { BSVersion: "1.29.1" },
            launchMods,
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.pathExistsSync as jest.Mock).mockReturnValue(true);
        (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
        (bsmExec as jest.Mock).mockRejectedValue(new Error("not nixos"));
    });

    it("keeps parallel views out of the default Linux launch environment", async () => {
        const env = await buildService().buildEnvVariables(
            buildLaunchOption(),
            steamPath,
            bsFolderPath
        );

        expect(env).toEqual(expect.objectContaining({
            WINEDLLOVERRIDES: "winhttp=n,b",
            STEAM_COMPAT_DATA_PATH: compatDataPath,
            STEAM_COMPAT_INSTALL_PATH: bsFolderPath,
            STEAM_COMPAT_CLIENT_INSTALL_PATH: steamPath,
            STEAM_COMPAT_APP_ID: BS_APP_ID,
            SteamEnv: "1",
            OXR_NO_TEXTURE_SOURCE_ALPHA: "1",
        }));
        expect(env).not.toHaveProperty("OXR_PARALLEL_VIEWS");
    });

    it("adds parallel views and proton logging only when their launch mods are active", async () => {
        const env = await buildService().buildEnvVariables(
            buildLaunchOption([LaunchMods.PARALLEL_VIEWS, LaunchMods.PROTON_LOGS]),
            steamPath,
            bsFolderPath
        );

        expect(env).toEqual(expect.objectContaining({
            OXR_PARALLEL_VIEWS: "1",
            PROTON_LOG: "1",
            PROTON_LOG_DIR: path.join(bsFolderPath, "Logs"),
        }));
    });

    it("keeps parallel views out of generated Linux shortcuts by default", async () => {
        const shortcutData = await buildService().getSteamShortcutData(
            "Beat Saber",
            "/icon.png",
            buildLaunchOption(),
            steamPath,
            bsFolderPath
        );

        expect(shortcutData.LaunchOptions).not.toContain("OXR_PARALLEL_VIEWS");
    });

    it("adds parallel views to generated Linux shortcuts when the launch mod is active", async () => {
        const service = buildService();
        const launchOption = buildLaunchOption([LaunchMods.PARALLEL_VIEWS]);

        const shortcutData = await service.getSteamShortcutData(
            "Beat Saber",
            "/icon.png",
            launchOption,
            steamPath,
            bsFolderPath
        );
        expect(shortcutData.LaunchOptions).toContain("OXR_PARALLEL_VIEWS=\"1\"");

        await service.createDesktopShortcut(
            "/shortcut.desktop",
            "Beat Saber",
            "/icon.png",
            launchOption,
            steamPath,
            bsFolderPath
        );

        expect(fs.writeFile).toHaveBeenCalledWith(
            "/shortcut.desktop",
            expect.stringContaining("OXR_PARALLEL_VIEWS=\"1\"")
        );
    });
});
