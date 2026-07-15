import { BSLauncherService } from "main/services/bs-launcher/bs-launcher.service";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { LaunchOption } from "shared/models/bs-launch";
import { Subject, of } from "rxjs";

jest.mock("electron", () => ({
    app: { getPath: () => "" },
    shell: { writeShortcutLink: jest.fn() },
}));

jest.mock("electron-log", () => ({
    info: jest.fn(),
    error: jest.fn(),
}));
jest.mock("color", () => jest.fn(() => ({ hex: jest.fn(() => "#000000") })));
jest.mock("png-to-ico", () => jest.fn());
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
jest.mock("main/services/vr-runtime.service", () => ({
    VrRuntimeService: { getInstance: jest.fn(() => ({ getActiveRuntime: jest.fn().mockResolvedValue("UNKNOWN") })) },
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
            LaunchMods.EDITOR,
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
        expect(shortcutLink).toContain("mapEditor=true");
        expect(shortcutLink).toContain("parallelViews=true");

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

    it("parses legacy skipSteam shortcut links", () => {
        const launchOptions = buildService().shortcutLinkToLaunchOptions(
            "bsm://launch?version=1.29.1&versionSteam=true&skipSteam=true"
        );

        expect(launchOptions.launchMods).toContain("skip_steam");
    });

    it("only emits skipSteam when preserving an existing shortcut", () => {
        const service = buildService();
        const launchOptions: LaunchOption = {
            version: { BSVersion: "1.29.1", steam: true },
            launchMods: [LaunchMods.SKIP_STEAM],
        };

        expect(service.createLaunchLink(launchOptions)).not.toContain("skipSteam");
        expect(service.createLaunchLink(launchOptions, { preserveLegacyOptions: true })).toContain("skipSteam=true");
    });
});

describe("BSLauncherService launch coordination", () => {
    function buildLaunchOptions(): LaunchOption {
        return {
            version: {
                BSVersion: "1.40.0",
                name: "launch-test",
                steam: true,
                oculus: false,
            },
            launchMods: [],
        };
    }

    it("allows only one main-process launch at a time and releases the guard on completion", () => {
        const firstLaunch = new Subject<any>();
        const launcher = { launch: jest.fn().mockReturnValueOnce(firstLaunch).mockReturnValueOnce(of({ type: "BS_LAUNCHED" })) };
        const service = Object.create(BSLauncherService.prototype) as BSLauncherService;
        Object.assign(service as any, {
            steamLauncher: launcher,
            oculusLauncher: launcher,
            staticConfig: { set: jest.fn() },
        });
        const launchOptions = buildLaunchOptions();

        const firstSubscription = service.launch(launchOptions).subscribe();
        const secondError = jest.fn();
        service.launch(launchOptions).subscribe({ error: secondError });

        expect(launcher.launch).toHaveBeenCalledTimes(1);
        expect(secondError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("already in progress") }));

        firstLaunch.complete();
        firstSubscription.unsubscribe();
        service.launch(launchOptions).subscribe();
        expect(launcher.launch).toHaveBeenCalledTimes(2);
    });

    it("keeps the main-process guard until the source completes after renderer teardown", () => {
        const firstLaunch = new Subject<any>();
        const launcher = { launch: jest.fn().mockReturnValue(firstLaunch) };
        const service = Object.create(BSLauncherService.prototype) as BSLauncherService;
        Object.assign(service as any, {
            steamLauncher: launcher,
            oculusLauncher: launcher,
            staticConfig: { set: jest.fn() },
        });
        const launchOptions = buildLaunchOptions();

        const rendererSubscription = service.launch(launchOptions).subscribe();
        rendererSubscription.unsubscribe();

        const overlappingError = jest.fn();
        service.launch(launchOptions).subscribe({ error: overlappingError });
        expect(overlappingError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("already in progress") }));
        expect(launcher.launch).toHaveBeenCalledTimes(1);

        firstLaunch.complete();

        const retryError = jest.fn();
        service.launch(launchOptions).subscribe({ error: retryError });
        expect(retryError).not.toHaveBeenCalled();
        expect(launcher.launch).toHaveBeenCalledTimes(2);
    });

    it("releases the main-process guard when a launcher throws before returning an observable", () => {
        const launcher = {
            launch: jest.fn()
                .mockImplementationOnce(() => { throw new Error("launcher setup failed"); })
                .mockReturnValueOnce(of({ type: "BS_LAUNCHED" })),
        };
        const service = Object.create(BSLauncherService.prototype) as BSLauncherService;
        Object.assign(service as any, {
            steamLauncher: launcher,
            oculusLauncher: launcher,
            staticConfig: { set: jest.fn() },
        });
        const launchOptions = buildLaunchOptions();

        service.launch(launchOptions).subscribe({ error: jest.fn() });
        const retryError = jest.fn();
        service.launch(launchOptions).subscribe({ error: retryError });

        expect(launcher.launch).toHaveBeenCalledTimes(2);
        expect(retryError).not.toHaveBeenCalled();
    });

    it("releases the main-process guard when saving the last launched version fails", () => {
        const launcher = { launch: jest.fn(() => of({ type: "BS_LAUNCHED" })) };
        const staticConfig = {
            set: jest.fn()
                .mockImplementationOnce(() => { throw new Error("configuration write failed"); })
                .mockReturnValueOnce(undefined),
        };
        const service = Object.create(BSLauncherService.prototype) as BSLauncherService;
        Object.assign(service as any, {
            steamLauncher: launcher,
            oculusLauncher: launcher,
            staticConfig,
        });
        const launchOptions = buildLaunchOptions();

        service.launch(launchOptions).subscribe({ error: jest.fn() });
        const retryError = jest.fn();
        service.launch(launchOptions).subscribe({ error: retryError });

        expect(staticConfig.set).toHaveBeenCalledTimes(2);
        expect(launcher.launch).toHaveBeenCalledTimes(1);
        expect(retryError).not.toHaveBeenCalled();
    });
});
