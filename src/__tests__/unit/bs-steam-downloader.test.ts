import path from "path";
import { lastValueFrom, Subject } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsSteamDownloaderService } from "main/services/bs-version-download/bs-steam-downloader.service";
import { BsDownloader } from "main/models/bs-downloader.class";
import { DepotDownloaderEvent, DepotDownloaderEventType, DepotDownloaderInfoEvent } from "shared/models/bs-version-download/depot-downloader.model";

let mockEvents: Subject<DepotDownloaderEvent>;
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockMetadata = jest.fn().mockResolvedValue({});
const mockReadJson = jest.fn().mockResolvedValue(undefined);
const mockLoadSession = jest.fn().mockResolvedValue(undefined);
const mockSaveSession = jest.fn();
const mockDestination = path.resolve("test-versions/1.40.0");

jest.mock("electron", () => ({ app: { on: jest.fn() } }));
jest.mock("main/constants", () => ({ BS_APP_ID: "620980", BS_DEPOT: "620981" }));
jest.mock("electron-log", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
jest.mock("fs-extra", () => ({ ensureDir: jest.fn().mockResolvedValue(undefined), readJson: (...args: unknown[]) => mockReadJson(...args) }));
jest.mock("main/helpers/fs.helpers", () => ({ ensurePathNotAlreadyExist: jest.fn(async (folder: string) => `${folder}-copy`) }));
jest.mock("main/services/installation-location.service", () => ({ InstallationLocationService: { getInstance: () => ({ versionsDirectory: () => path.dirname(mockDestination) }) } }));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: () => ({ getVersionPath: async () => mockDestination, initVersionMetadata: (...args: unknown[]) => mockMetadata(...args) }) } }));
jest.mock("main/services/bs-version-download/steam-download-session", () => ({ loadSteamDownloadSession: (...args: unknown[]) => mockLoadSession(...args), saveSteamDownloadSession: (...args: unknown[]) => mockSaveSession(...args) }));
jest.mock("main/models/bs-downloader.class", () => ({ BsDownloader: jest.fn().mockImplementation(() => ({ $events: () => mockEvents, stop: mockStop, sendInput: jest.fn(), running: true })) }));

const version: BSVersion = { BSVersion: "1.40.0", BSManifest: "12345678901234567890" };
const settle = () => new Promise<void>(resolve => { setImmediate(resolve); });

describe("Steam download backend", () => {
    beforeEach(() => {
        mockEvents = new Subject();
        jest.clearAllMocks();
        mockReadJson.mockResolvedValue(undefined);
        mockLoadSession.mockResolvedValue(undefined);
        mockStop.mockResolvedValue(undefined);
    });

    it("keeps manifests lossless, passes an absolute destination and commits metadata only on Finished", async () => {
        const result = lastValueFrom(BsSteamDownloaderService.getInstance().downloadBsVersion({ bsVersion: version, username: "account", password: "password", stay: true }));
        await settle();
        expect(jest.mocked(BsDownloader).mock.calls.at(-1)[0]).toMatchObject({ manifest: version.BSManifest, directory: `${mockDestination}-copy`, password: "password" });
        mockEvents.next({ type: DepotDownloaderEventType.Info, subType: DepotDownloaderInfoEvent.Progress, data: "50" });
        await settle();
        expect(mockMetadata).not.toHaveBeenCalled();
        mockEvents.next({ type: DepotDownloaderEventType.Info, subType: DepotDownloaderInfoEvent.Finished, data: "" });
        mockEvents.complete();
        await result;
        expect(mockMetadata).toHaveBeenCalledTimes(1);
    });

    it("does not publish metadata for a failed transfer", async () => {
        const result = lastValueFrom(BsSteamDownloaderService.getInstance().downloadBsVersion({ bsVersion: version }));
        await settle();
        mockEvents.error(new Error("network failed"));
        await expect(result).rejects.toThrow("network failed");
        expect(mockMetadata).not.toHaveBeenCalled();
    });

    it("reuses an unfinished matching installation and a securely saved session", async () => {
        mockReadJson.mockResolvedValue({ depot: "620981", manifest: version.BSManifest });
        mockLoadSession.mockResolvedValue({ username: "account", refreshToken: "token" });
        const sub = BsSteamDownloaderService.getInstance().autoDownloadBsVersion({ bsVersion: version, username: "account" }).subscribe();
        await settle();
        expect(jest.mocked(BsDownloader).mock.calls.at(-1)[0]).toMatchObject({ directory: mockDestination, refreshToken: "token", password: "" });
        sub.unsubscribe();
        expect(mockMetadata).not.toHaveBeenCalled();
    });

    it("waits for the previous child to release its installation lock", async () => {
        let release: () => void;
        mockStop.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
        const sub = BsSteamDownloaderService.getInstance().downloadBsVersion({ bsVersion: version, isVerification: true }).subscribe();
        await settle();
        expect(BsDownloader).not.toHaveBeenCalled();
        release();
        await settle();
        expect(jest.mocked(BsDownloader).mock.calls.at(-1)[0].directory).toBe(mockDestination);
        sub.unsubscribe();
    });

    it("completes a cancelled request while process creation is still pending", async () => {
        let release: () => void;
        mockStop.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
        const complete = jest.fn();
        const service = BsSteamDownloaderService.getInstance();
        service.downloadBsVersion({ bsVersion: version }).subscribe({ complete });
        service.stopDownload();
        release();
        await settle();
        expect(complete).toHaveBeenCalledTimes(1);
        expect(mockMetadata).not.toHaveBeenCalled();
    });
});
