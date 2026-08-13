import { mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { BSLocalVersionService } from "main/services/bs-local-version.service";
import { BSVersion } from "shared/bs-version.interface";

jest.mock("electron", () => ({
    app: { getPath: jest.fn(() => "") },
}));
jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("main/services/bs-version-lib.service", () => ({
    BSVersionLibService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/installation-location.service", () => ({
    InstallationLocationService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/steam.service", () => ({
    SteamService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/oculus.service", () => ({
    OculusService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/configuration.service", () => ({
    ConfigurationService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/folder-linker.service", () => ({
    FolderLinkerService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock("main/services/static-configuration.service", () => ({
    StaticConfigurationService: { getInstance: jest.fn(() => ({})) },
}));

type BSLocalVersionServiceInternals = {
    versionLibService: {
        getCachedVersions: jest.Mock<Promise<BSVersion[]>, []>;
    };
    getVersionFromGlobalGameManagerFile(versionFilePath: string): Promise<BSVersion>;
};

describe("BSLocalVersionService local version detection", () => {
    let tempDirectory: string;

    beforeEach(async () => {
        tempDirectory = await mkdtemp(path.join(os.tmpdir(), "bs-manager-version-detection-"));
    });

    afterEach(async () => {
        await rm(tempDirectory, { recursive: true, force: true });
    });

    it("checks recent versions first without mutating the shared cached catalog", async () => {
        const versionFilePath = path.join(tempDirectory, "globalgamemanagers");
        await writeFile(versionFilePath, "metadata 1.2.10 metadata\n", "utf-8");

        const cachedVersions = [
            { BSVersion: "1.2" },
            { BSVersion: "1.2.10" },
        ] as BSVersion[];
        Object.freeze(cachedVersions);

        const service = Object.create(BSLocalVersionService.prototype) as BSLocalVersionService;
        const internals = service as unknown as BSLocalVersionServiceInternals;
        internals.versionLibService = {
            getCachedVersions: jest.fn().mockResolvedValue(cachedVersions),
        };

        await expect(internals.getVersionFromGlobalGameManagerFile(versionFilePath)).resolves.toEqual(cachedVersions[1]);
        expect(cachedVersions.map(version => version.BSVersion)).toEqual(["1.2", "1.2.10"]);
    });
});
