import { BSLauncherService } from "main/services/bs-launcher/bs-launcher.service";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { LaunchOption } from "shared/models/bs-launch";

jest.mock("electron", () => ({
    app: { getPath: () => "" },
    shell: { writeShortcutLink: jest.fn() },
}));

jest.mock("electron-log", () => ({
    info: jest.fn(),
    error: jest.fn(),
}));
jest.mock("color", () => jest.fn(() => ({ hex: jest.fn(() => "#000000") })));
jest.mock("to-ico", () => jest.fn());
jest.mock("@resvg/resvg-js", () => ({
    Resvg: jest.fn(() => ({
        render: jest.fn(() => ({ asPng: jest.fn(() => Buffer.from("")) })),
    })),
}));
jest.mock("fs-extra", () => ({
    ensureDir: jest.fn(),
    writeFile: jest.fn(),
}));

jest.mock("main/services/bs-local-version.service", () => ({
    BSLocalVersionService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/bsm-protocol.service", () => ({
    BsmProtocolService: { getInstance: jest.fn(() => ({ on: jest.fn() })) },
}));
jest.mock("main/services/window-manager.service", () => ({
    WindowManagerService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/ipc.service", () => ({
    IpcService: { getInstance: jest.fn(() => ({ once: jest.fn() })) },
}));
jest.mock("main/services/bs-version-lib.service", () => ({
    BSVersionLibService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/bs-launcher/steam-launcher.service", () => ({
    SteamLauncherService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/bs-launcher/oculus-launcher.service", () => ({
    OculusLauncherService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/static-configuration.service", () => ({
    StaticConfigurationService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/steam.service", () => ({
    SteamService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/linux.service", () => ({
    LinuxService: { getInstance: jest.fn(() => ({})) },
}));

describe("BSLauncherService shortcut links", () => {
    function buildService(): BSLauncherService {
        const service = Object.create(BSLauncherService.prototype) as BSLauncherService;

        (service as any).bsmProtocolService = {
            buildLink: (path: string, params: Record<string, string>) => {
                const url = new URL(`bsm://${path}`);
                Object.entries(params).forEach(([key, value]) => {
                    url.searchParams.set(key, value);
                });
                return url;
            },
        };

        return service;
    }

    it("preserves supported launch mods through bsm shortcut links", () => {
        const service = buildService();
        const launchMods = [
            LaunchMods.OCULUS,
            LaunchMods.FPFC,
            LaunchMods.DEBUG,
            LaunchMods.SKIP_STEAM,
            LaunchMods.PROTON_LOGS,
            LaunchMods.PARALLEL_VIEWS,
        ];
        const launchOptions: LaunchOption = {
            version: {
                BSVersion: "1.29.1",
                name: "shortcut-test",
                steam: true,
                oculus: false,
                ino: 42,
            },
            command: "--custom-launch-arg",
            launchMods,
        };

        const shortcutLink = service.createLaunchLink(launchOptions);
        const roundTrippedOptions = service.shortcutLinkToLaunchOptions(shortcutLink);

        expect(roundTrippedOptions.launchMods).toEqual(launchMods);
        expect(roundTrippedOptions.command).toBe(launchOptions.command);
        expect(roundTrippedOptions.version).toEqual(expect.objectContaining({
            BSVersion: launchOptions.version.BSVersion,
            name: launchOptions.version.name,
            steam: true,
            oculus: false,
            ino: launchOptions.version.ino,
        }));
    });
});
