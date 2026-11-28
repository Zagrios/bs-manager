import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { LinuxService } from "main/services/linux.service";

jest.mock("electron", () => ({ app: { getPath: () => "" } }));
jest.mock("electron-log", () => ({ info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() }));
jest.mock("main/services/installation-location.service", () => ({ InstallationLocationService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/static-configuration.service", () => ({ StaticConfigurationService: { getInstance: jest.fn(() => ({})) } }));

describe("LinuxService.findArm64ProtonFolders", () => {
    let root: string;

    // A Proton install in a library's steamapps/common, with the given Wine binary
    async function proton(library: string, name: string, wine: string, build?: string) {
        const folder = path.join(library, "steamapps", "common", name);
        for (const file of ["proton", wine]) {
            await fs.outputFile(path.join(folder, file), "");
            await fs.chmod(path.join(folder, file), 0o755);
        }
        if (build) {
            await fs.outputFile(path.join(folder, "version"), `1764000000 ${build}\n`);
        }
        return folder;
    }

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), "bsm-proton-"));
    });

    afterEach(async () => {
        await fs.remove(root);
    });

    it("finds the ARM64 Protons in every library, with their builds", async () => {
        const main = path.join(root, "Steam");
        const sd = path.join(root, "sdcard");
        const arm11 = await proton(main, "Proton 11.0 (ARM64)", "files/bin-arm64/wine", "proton-11.0-2e-arm64");
        await proton(main, "Proton 9.0 (Beta)", "files/bin/wine64", "proton-9.0-4");
        const experimental = await proton(sd, "Proton Experimental (ARM64)", "files/bin-arm64/wine");
        await fs.ensureDir(path.join(main, "steamapps", "common", "Beat Saber"));

        const service = Reflect.construct(LinuxService, []) as LinuxService;
        await expect(service.findArm64ProtonFolders([main, sd, main, path.join(root, "missing")])).resolves.toEqual([
            { folder: arm11, build: "proton-11.0-2e-arm64" },
            { folder: experimental, build: undefined },
        ]);
    });
});
