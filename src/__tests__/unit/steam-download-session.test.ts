import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import os from "os";
import path from "path";
import { loadSteamDownloadSession, saveSteamDownloadSession } from "main/services/bs-version-download/steam-download-session";

let mockDirectory: string;
const mockAvailable = jest.fn(() => true);
jest.mock("electron", () => ({
    app: { getPath: () => mockDirectory },
    safeStorage: {
        isEncryptionAvailable: () => mockAvailable(),
        getSelectedStorageBackend: () => "gnome_libsecret",
        encryptString: (value: string) => Buffer.from(value).map(byte => byte ^ 0x55),
        decryptString: (value: Buffer) => value.map(byte => byte ^ 0x55).toString(),
    },
}));

describe("remembered Steam downloader sessions", () => {
    beforeEach(async () => { mockDirectory = await mkdtemp(path.join(os.tmpdir(), "bs-session-test-")); mockAvailable.mockReturnValue(true); });
    afterEach(async () => { await rm(mockDirectory, { recursive: true, force: true }); });

    it("stores encrypted tokens atomically and finds accounts regardless of case", async () => {
        await saveSteamDownloadSession({ username: "Account", refreshToken: "first-secret" });
        await saveSteamDownloadSession({ username: "Account", refreshToken: "second-secret" });
        const files = await readdir(path.join(mockDirectory, "steam-sessions"));
        expect(files).toHaveLength(1);
        expect(files[0]).toMatch(/^[0-9a-f]{64}\.bin$/);
        expect((await readFile(path.join(mockDirectory, "steam-sessions", files[0]))).toString()).not.toContain("second-secret");
        expect(await loadSteamDownloadSession("account")).toEqual({ username: "Account", refreshToken: "second-secret" });
        expect(await loadSteamDownloadSession("another-account")).toBeUndefined();
    });

    it("falls back to interactive login if secure storage is unavailable", async () => {
        mockAvailable.mockReturnValue(false);
        await expect(saveSteamDownloadSession({ username: "account", refreshToken: "secret" })).rejects.toThrow("Secure credential storage unavailable");
        expect(await loadSteamDownloadSession("account")).toBeUndefined();
        expect(await readdir(mockDirectory)).toEqual([]);
    });
});
