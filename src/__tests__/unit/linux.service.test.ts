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

jest.mock("fs-extra", () => ({
    __esModule: true,
    default: {
        accessSync: jest.fn(),
        constants: { X_OK: 1 },
        existsSync: jest.fn(() => true),
        ensureDir: jest.fn(),
        pathExistsSync: jest.fn(() => true),
        statSync: jest.fn(() => ({ isFile: () => true })),
        writeFile: jest.fn(),
    },
}));

describe("LinuxService.buildEnvVariables", () => {
    const steamPath = "/Steam Library";
    const bsFolderPath = "/Beat Saber/1.45.2";
    const sharedContentPath = "/shared-content";
    const compatDataPath = path.resolve(sharedContentPath, "compatdata");
    const protonPath = path.join("/Proton Experimental", "proton");
    const beatSaberExePath = path.join(bsFolderPath, "Beat Saber.exe");

    function buildService(): LinuxService {
        const service = Reflect.construct(LinuxService, []) as LinuxService;

        (service as any).installLocationService = {
            sharedContentPath: () => sharedContentPath,
        };
        (service as any).staticConfig = {
            has: jest.fn(() => true),
            get: jest.fn(() => "/Proton Experimental"),
            set: jest.fn(async () => undefined),
        };
        (service as any).nixOS = false;

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
        (fs.accessSync as jest.Mock).mockImplementation(() => undefined);
        (fs.pathExistsSync as jest.Mock).mockReturnValue(true);
        (fs.statSync as jest.Mock).mockReturnValue({ isFile: () => true });
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

    it("places the environment before the Steam command and quotes the Beat Saber executable", async () => {
        const shortcutData = await buildService().getSteamShortcutData(
            "Beat Saber",
            "/icon.png",
            buildLaunchOption(),
            steamPath,
            bsFolderPath
        );

        expect(shortcutData.Exe).toBe(protonPath);
        expect(shortcutData.LaunchOptions).toContain(`SteamGameId="620980" %command% run "${beatSaberExePath}"`);
    });

    it.each([
        { nixOS: false, desktopPrefix: `"${protonPath}" run` },
        { nixOS: true, desktopPrefix: `steam-run "${protonPath}" run` },
    ])("preserves custom options in Steam and desktop shortcuts (NixOS: $nixOS)", async ({ nixOS, desktopPrefix }) => {
        const service = buildService();
        jest.spyOn(service, "isNixOS").mockResolvedValue(nixOS);
        const launchOption = {
            ...buildLaunchOption(),
            command: 'CUSTOM_OPTION="two words" gamemoderun %command% --debug',
        };
        const expectedEnvironment = [
            'WINEDLLOVERRIDES="winhttp=n,b"',
            `STEAM_COMPAT_DATA_PATH="${compatDataPath}"`,
            'STEAM_COMPAT_INSTALL_PATH="/Beat Saber/1.45.2"',
            'STEAM_COMPAT_CLIENT_INSTALL_PATH="/Steam Library"',
            'STEAM_COMPAT_APP_ID="620980"',
            'SteamEnv="1"',
            'OXR_NO_TEXTURE_SOURCE_ALPHA="1"',
            'CUSTOM_OPTION="two words"',
            'SteamAppId="620980"',
            'SteamOverlayGameId="620980"',
            'SteamGameId="620980"',
        ].join(" ");

        const shortcutData = await service.getSteamShortcutData(
            "Beat Saber", "/icon.png", launchOption, steamPath, bsFolderPath
        );
        expect(shortcutData.LaunchOptions).toBe(
            `${expectedEnvironment} gamemoderun %command% run "${beatSaberExePath}" --debug`
        );

        await expect(service.createDesktopShortcut(
            "/shortcut.desktop", "Beat Saber", "/icon.png", launchOption, steamPath, bsFolderPath
        )).resolves.toBe(true);
        expect(fs.writeFile).toHaveBeenCalledWith(
            "/shortcut.desktop",
            expect.stringContaining(`\nExec=${expectedEnvironment} gamemoderun ${desktopPrefix} "${beatSaberExePath}" --debug`)
        );
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

    it("persists a trimmed Proton folder when its binaries are valid", async () => {
        const service = buildService();

        await expect(service.setProtonFolder("  /proton-candidate  ")).resolves.toBe(true);
        expect((service as any).staticConfig.set).toHaveBeenCalledWith(
            "proton-folder",
            "/proton-candidate"
        );
    });

    it("does not persist an invalid Proton folder", async () => {
        const service = buildService();
        const verifyProtonPath = jest.spyOn(service, "verifyProtonPath").mockReturnValue(false);

        await expect(service.setProtonFolder("  /invalid-proton  ")).resolves.toBe(false);
        expect(verifyProtonPath).toHaveBeenCalledWith("/invalid-proton");
        expect((service as any).staticConfig.set).not.toHaveBeenCalled();
    });

    it("does not replace the stored Proton folder with an empty submitted path", async () => {
        const service = buildService();

        await expect(service.setProtonFolder("   ")).resolves.toBe(false);
        expect((service as any).staticConfig.set).not.toHaveBeenCalled();
    });

    it("accepts a Proton folder with executable regular Proton and Wine files", () => {
        expect(buildService().verifyProtonPath("/proton-candidate")).toBe(true);
    });

    it("accepts and uses the native Wine binary from ARM64 Proton", () => {
        const protonPath = path.join("/proton-candidate", "proton");
        const armWinePath = path.join("/proton-candidate", "files", "bin-arm64", "wine");
        (fs.pathExistsSync as jest.Mock).mockImplementation(filePath =>
            [protonPath, armWinePath].includes(filePath)
        );

        const service = buildService();
        (service as any).staticConfig.get.mockReturnValue("/proton-candidate");
        expect(service.verifyProtonPath("/proton-candidate")).toBe(true);
        expect(service.getWinePath()).toBe(armWinePath);
    });

    it("rejects a Proton folder when a required binary path is a directory", () => {
        (fs.statSync as jest.Mock).mockReturnValue({ isFile: () => false });

        expect(buildService().verifyProtonPath("/proton-candidate")).toBe(false);
    });

    it("rejects a Proton folder when a required binary is not executable", () => {
        (fs.accessSync as jest.Mock).mockImplementation(() => {
            throw new Error("not executable");
        });

        expect(buildService().verifyProtonPath("/proton-candidate")).toBe(false);
    });

    it("rejects a Proton folder when a required binary is missing", () => {
        (fs.pathExistsSync as jest.Mock).mockReturnValue(false);

        expect(buildService().verifyProtonPath("/proton-candidate")).toBe(false);
    });
});
