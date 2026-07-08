import fs from "fs-extra";
import path from "path";
import { LinuxService } from "main/services/linux.service";
import { BS_APP_ID } from "main/constants";
import { LaunchMod, LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { LaunchOption } from "shared/models/bs-launch";

jest.mock("electron", () => ({
    app: { getPath: () => "" },
}));

jest.mock("electron-log", () => ({
    info: jest.fn(),
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
});
