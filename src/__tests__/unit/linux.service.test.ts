import fs from "fs-extra";
import path from "path";
import { LinuxService } from "main/services/linux.service";
import { BSLaunchError } from "shared/models/bs-launch";
import { bsmExec } from "main/helpers/os.helpers";

jest.mock("electron", () => ({
    app: { getPath: (name: string) => name === "exe" ? "/opt/BS Manager/bsmanager" : "" },
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

describe("LinuxService", () => {
    const steamPath = "/Steam Library";
    const sharedContentPath = "/shared-content";
    const compatDataPath = path.resolve(sharedContentPath, "compatdata");
    const protonPath = path.join("/Proton Experimental", "proton");

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

    beforeEach(() => {
        jest.clearAllMocks();
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.accessSync as jest.Mock).mockImplementation(() => undefined);
        (fs.pathExistsSync as jest.Mock).mockReturnValue(true);
        (fs.statSync as jest.Mock).mockReturnValue({ isFile: () => true });
        (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
        (bsmExec as jest.Mock).mockRejectedValue(new Error("not nixos"));
    });

    it("resolves the Proton facts used to launch the game", async () => {
        await expect(buildService().getProtonConfig(steamPath, { createCompatData: true })).resolves.toEqual({
            protonPath,
            compatDataPath,
            steamPath,
            nixOS: false,
        });
        expect(fs.ensureDir).not.toHaveBeenCalled();
    });

    it("detects NixOS so Proton can be wrapped in steam-run", async () => {
        (bsmExec as jest.Mock).mockResolvedValue({ stdout: "24.05", stderr: "" });
        const service = buildService();
        (service as any).nixOS = undefined;

        await expect(service.getProtonConfig(steamPath, { createCompatData: true }))
            .resolves.toMatchObject({ nixOS: true });
    });

    it("creates a missing compat data folder before launching the game", async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        await buildService().getProtonConfig(steamPath, { createCompatData: true });

        expect(fs.ensureDir).toHaveBeenCalledWith(compatDataPath);
    });

    it("requires an existing prefix for commands run inside it", async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        await expect(buildService().getProtonConfig(steamPath, { createCompatData: false }))
            .rejects.toMatchObject({ code: "no-wineprefix" });
        expect(fs.ensureDir).not.toHaveBeenCalled();
    });

    it("reports a missing Proton folder before a missing prefix", async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        const service = buildService();
        (service as any).staticConfig.has.mockReturnValue(false);

        await expect(service.getProtonConfig(steamPath, { createCompatData: false }))
            .rejects.toMatchObject({ code: BSLaunchError.PROTON_NOT_SET });
    });

    it("persists a trimmed Proton folder when its binaries are valid", async () => {
        const service = buildService();

        await expect(service.setProtonFolder("  /proton-candidate  ")).resolves.toBe(true);
        expect((service as any).staticConfig.set).toHaveBeenCalledWith(
            "proton-folder",
            "/proton-candidate"
        );
    });

    it("creates a desktop shortcut to BSManager without requiring a configured Proton folder", async () => {
        const service = buildService();
        (service as any).staticConfig.has.mockReturnValue(false);

        await expect(service.createDesktopShortcut(
            "/shortcut.desktop", "Beat Saber", "/icon.png", "bsmanager://launch/?version=1.45.2&desktopMode=true"
        )).resolves.toBe(true);

        expect(fs.writeFile).toHaveBeenCalledWith(
            "/shortcut.desktop",
            expect.stringContaining('Exec="/opt/BS Manager/bsmanager" "bsmanager://launch/?version=1.45.2&desktopMode=true"')
        );
    });

    it("reports desktop shortcut write failures", async () => {
        (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error("read-only desktop"));

        await expect(buildService().createDesktopShortcut(
            "/shortcut.desktop", "Beat Saber", "/icon.png", "bsmanager://launch/?version=1.45.2"
        )).resolves.toBe(false);
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
