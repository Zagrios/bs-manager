import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { resolveSteamDownloadDestination } from "main/services/bs-version-download/steam-download-destination";
import { BSVersion } from "shared/bs-version.interface";

jest.mock("electron", () => ({ app: { getPath: () => "", getName: () => "" } }));
jest.mock("electron-log", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const version: BSVersion = { BSVersion: "1.40.0", BSManifest: "12345678901234567890" };

describe("Steam download destination", () => {
    let root: string;
    let versionPath: string;
    const locations = () => ({ depot: "620981", versionPath: async () => versionPath, versionsDirectory: () => root });

    beforeEach(async () => {
        root = await mkdtemp(path.join(os.tmpdir(), "bs-destination-test-"));
        versionPath = path.join(root, "1.40.0");
    });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });

    it("downloads into the version folder when it is free", async () => {
        const { directory, version: installed } = await resolveSteamDownloadDestination({ bsVersion: version }, locations());
        expect(directory).toBe(versionPath);
        expect(installed).toEqual({ ...version, metadata: { store: "steam", id: "" } });
    });

    it("downloads next to an existing installation and keeps the manifest lossless", async () => {
        await mkdir(versionPath);
        const { directory, version: installed } = await resolveSteamDownloadDestination({ bsVersion: version }, locations());
        expect(directory).toBe(`${versionPath} (1)`);
        expect(installed).toMatchObject({ BSManifest: version.BSManifest, name: "1.40.0 (1)" });
    });

    it("resumes an unfinished download of the same manifest and verifies in place", async () => {
        await mkdir(path.join(versionPath, ".bs-download"), { recursive: true });
        await writeFile(path.join(versionPath, ".bs-download", "pending.json"), JSON.stringify({ depot: "620981", manifest: version.BSManifest }));
        expect((await resolveSteamDownloadDestination({ bsVersion: version }, locations())).directory).toBe(versionPath);
        expect((await resolveSteamDownloadDestination({ bsVersion: { ...version, BSManifest: "1" } }, locations())).directory).toBe(`${versionPath} (1)`);
        expect((await resolveSteamDownloadDestination({ bsVersion: { ...version, BSManifest: "1" }, isVerification: true }, locations())).directory).toBe(versionPath);
    });
});
