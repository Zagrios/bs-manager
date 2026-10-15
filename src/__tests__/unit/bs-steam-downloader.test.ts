import { Subject } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsStore } from "shared/models/bs-store.enum";
import type { SteamDownloadSession } from "main/models/bs-downloader.class";
import { SteamDownloader, SteamDownloadProcess, SteamDownloadProcessOptions } from "main/services/bs-version-download/steam-downloader";
import type { SteamSessionStorage } from "main/services/bs-version-download/steam-download-session";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { DepotDownloaderErrorEvent, DepotDownloaderEventType, DepotDownloaderEvent, DepotDownloaderInfoEvent, DepotDownloaderWarningEvent } from "shared/models/bs-version-download/depot-downloader.model";
import { SteamDownloadEvent, SteamDownloadRequest } from "shared/models/bs-version-download/steam-download.model";

class FakeProcess implements SteamDownloadProcess {
    public readonly events = new Subject<DepotDownloaderEvent>();
    public readonly inputs: string[] = [];
    public stopped = false;
    public closed: Promise<void> = Promise.resolve();

    public constructor(public readonly options: SteamDownloadProcessOptions, public readonly onSession?: (session: SteamDownloadSession) => Promise<void>) {}

    public $events() { return this.events.asObservable(); }
    public sendInput(value: string) { this.inputs.push(value); return true; }
    public stop() { this.stopped = true; this.events.complete(); return this.closed; }

    public info(subType: DepotDownloaderInfoEvent, data = "") { this.events.next({ type: DepotDownloaderEventType.Info, subType, data }); }
    public finish() { this.info(DepotDownloaderInfoEvent.Finished); this.events.complete(); }
    public fail(code: DepotDownloaderErrorEvent) { this.events.next({ type: DepotDownloaderEventType.Error, subType: code, data: "" }); }
}

function memoryStorage(saved?: SteamDownloadSession): SteamSessionStorage & { username?: string; sessions: Map<string, SteamDownloadSession> } {
    const sessions = new Map<string, SteamDownloadSession>(saved ? [[saved.username.toLowerCase(), saved]] : []);
    const storage = {
        username: saved?.username,
        sessions,
        loadUsername: async () => storage.username,
        saveUsername: async (username: string) => { storage.username = username; },
        loadSession: async (username?: string) => sessions.get(username?.toLowerCase()),
        saveSession: async (session: SteamDownloadSession) => { sessions.set(session.username.toLowerCase(), session); },
        clear: async () => { storage.username = undefined; sessions.clear(); },
    };
    return storage;
}

const version: BSVersion = { BSVersion: "1.40.0", BSManifest: "12345678901234567890" };
const installed: BSVersion = { ...version, metadata: { store: BsStore.STEAM, id: "" } };
const flush = async () => { for (let i = 0; i < 10; i++) { await new Promise<void>(resolve => { setImmediate(resolve); }); } };

function setup(saved?: SteamDownloadSession) {
    const processes: FakeProcess[] = [];
    const storage = memoryStorage(saved);
    const commitVersion = jest.fn(async (): Promise<void> => undefined);
    let ids = 0;
    const downloader = new SteamDownloader({
        createProcess: (options, _, onSession) => {
            const process = new FakeProcess(options, onSession);
            processes.push(process);
            return process;
        },
        resolveDestination: async () => ({ directory: "/versions/1.40.0", version: installed }),
        commitVersion,
        storage,
        createId: () => `download-${++ids}`,
    });

    const start = (request: SteamDownloadRequest = { bsVersion: version }) => {
        const run = { events: [] as SteamDownloadEvent[], types: () => run.events.map(event => event.type), error: undefined as CustomError, completed: false };
        downloader.download(request).subscribe({ next: event => run.events.push(event), error: error => { run.error = error; }, complete: () => { run.completed = true; } });
        return run;
    };

    return { downloader, processes, storage, commitVersion, start };
}

describe("Steam download module", () => {

    it("downloads silently with the remembered session", async () => {
        const { processes, commitVersion, start } = setup({ username: "Account", refreshToken: "token" });
        const run = start();
        await flush();

        expect(processes).toHaveLength(1);
        expect(processes[0].options).toEqual({ directory: "/versions/1.40.0", manifest: version.BSManifest, username: "Account", refreshToken: "token" });
        expect(processes[0].onSession).toBeDefined();

        processes[0].info(DepotDownloaderInfoEvent.Progress, "50,5");
        processes[0].finish();
        await flush();

        expect(run.events).toEqual([
            { type: "Started", downloadId: "download-1", version: installed, isVerification: false },
            { type: "Progress", progress: 50.5 },
            { type: "Done", version: installed },
        ]);
        expect(commitVersion).toHaveBeenCalledTimes(1);
        expect(run.completed).toBe(true);
    });

    it("asks to log in without a remembered session and completes with the QR code", async () => {
        const { downloader, processes, commitVersion, start } = setup();
        const run = start({ bsVersion: version, isVerification: true });
        await flush();

        expect(processes).toHaveLength(1);
        expect(processes[0].options.qr).toBe(true);
        expect(processes[0].onSession).toBeUndefined();

        processes[0].info(DepotDownloaderInfoEvent.QRCode, "https://s.team/q/1");
        processes[0].info(DepotDownloaderInfoEvent.SteamID, "7656");
        await flush();
        expect(downloader.respond("download-1", { type: "Password", username: "late", password: "late", stay: false })).toBe(false);

        processes[0].finish();
        await flush();

        expect(run.types()).toEqual(["Started", "NeedsLogin", "QrCode", "LoggedIn", "Done"]);
        expect(run.events[0]).toMatchObject({ isVerification: true });
        expect(processes).toHaveLength(1);
        expect(commitVersion).toHaveBeenCalledTimes(1);
        expect(run.completed).toBe(true);
    });

    it("switches to the password, asks for the Steam Guard code and remembers the session", async () => {
        const { downloader, processes, storage, start } = setup();
        const run = start();
        await flush();

        expect(downloader.respond("download-1", { type: "Password", username: "account", password: "secret", stay: true })).toBe(true);
        await flush();

        expect(processes[0].stopped).toBe(true);
        expect(processes).toHaveLength(2);
        expect(processes[1].options).toMatchObject({ username: "account", password: "secret" });
        expect(processes[1].options.qr).toBeUndefined();

        processes[1].info(DepotDownloaderInfoEvent.Guard);
        await flush();
        expect(downloader.respond("download-1", { type: "GuardCode", code: "ABCDE" })).toBe(true);
        expect(processes[1].inputs).toEqual(["ABCDE"]);

        await processes[1].onSession({ username: "Account", refreshToken: "token" });
        processes[1].info(DepotDownloaderInfoEvent.SteamID, "7656");
        processes[1].finish();
        await flush();

        expect(run.types()).toEqual(["Started", "NeedsLogin", "NeedsGuardCode", "LoggedIn", "Done"]);
        expect(storage.username).toBe("Account");
        expect(storage.sessions.get("account")).toEqual({ username: "Account", refreshToken: "token" });
        expect(await downloader.session.exists()).toBe(true);
    });

    it("does not remember the session when the user did not ask to stay logged in", async () => {
        const { downloader, processes, start } = setup();
        start();
        await flush();
        downloader.respond("download-1", { type: "Password", username: "account", password: "secret", stay: false });
        await flush();
        expect(processes[1].onSession).toBeUndefined();
    });

    it("asks for the mobile approval", async () => {
        const { processes, start } = setup({ username: "account", refreshToken: "token" });
        const run = start();
        await flush();
        processes[0].info(DepotDownloaderInfoEvent.MobileApp);
        processes[0].info(DepotDownloaderInfoEvent.SteamID, "7656");
        await flush();
        expect(run.types()).toEqual(["Started", "NeedsMobileApproval", "LoggedIn"]);
    });

    it("forgets a remembered session that Steam refused and asks to log in", async () => {
        const { downloader, processes, storage, start } = setup({ username: "account", refreshToken: "expired" });
        const run = start();
        await flush();

        processes[0].info(DepotDownloaderInfoEvent.Password);
        await flush();

        expect(processes[0].stopped).toBe(true);
        expect(processes[1].options.qr).toBe(true);
        expect(run.types()).toEqual(["Started", "NeedsLogin"]);
        expect(run.error).toBeUndefined();
        expect(storage.username).toBeUndefined();
        expect(storage.sessions.size).toBe(0);
        expect(await downloader.session.exists()).toBe(false);
    });

    it("fails with the bs-downloader error code and forgets the session", async () => {
        const { downloader, processes, storage, commitVersion, start } = setup();
        const run = start();
        await flush();
        downloader.respond("download-1", { type: "Password", username: "account", password: "secret", stay: true });
        await flush();
        await processes[1].onSession({ username: "account", refreshToken: "token" });

        processes[1].info(DepotDownloaderInfoEvent.Progress, "10");
        processes[1].info(DepotDownloaderInfoEvent.Progress, "10");
        processes[1].fail(DepotDownloaderErrorEvent.ConnectionError);
        await flush();

        expect(run.error).toBeInstanceOf(CustomError);
        expect(run.error.code).toBe(DepotDownloaderErrorEvent.ConnectionError);
        expect(run.completed).toBe(false);
        expect(storage.username).toBeUndefined();
        expect(storage.sessions.size).toBe(0);
        expect(commitVersion).not.toHaveBeenCalled();
    });

    it("reports a missing bs-downloader executable", async () => {
        const storage = memoryStorage();
        const downloader = new SteamDownloader({
            createProcess: () => { throw new CustomError("bs-downloader executable not found", DepotDownloaderErrorEvent.ExeNotFoundLinux); },
            resolveDestination: async () => ({ directory: "/versions/1.40.0", version: installed }),
            commitVersion: jest.fn(),
            storage,
            createId: () => "download",
        });
        const error = jest.fn();
        downloader.download({ bsVersion: version }).subscribe({ error });
        await flush();
        expect(error.mock.calls[0][0].code).toBe(DepotDownloaderErrorEvent.ExeNotFoundLinux);
    });

    it("forwards warnings", async () => {
        const { processes, start } = setup({ username: "account", refreshToken: "token" });
        const run = start();
        await flush();
        processes[0].events.next({ type: DepotDownloaderEventType.Warning, subType: DepotDownloaderWarningEvent.ManifestChecksum, data: "" });
        await flush();
        expect(run.events.at(-1)).toEqual({ type: "Warning", code: DepotDownloaderWarningEvent.ManifestChecksum });
    });

    it("stops the download while the user logs in", async () => {
        const { downloader, processes, commitVersion, start } = setup();
        const run = start();
        await flush();

        let release: () => void;
        processes[0].closed = new Promise<void>(resolve => { release = resolve; });
        const stopped = jest.fn();
        downloader.stop().then(stopped);
        await flush();

        expect(processes[0].stopped).toBe(true);
        expect(run.completed).toBe(true);
        expect(stopped).not.toHaveBeenCalled();

        release();
        await flush();
        expect(stopped).toHaveBeenCalled();
        expect(run.types()).toEqual(["Started", "NeedsLogin"]);
        expect(downloader.respond("download-1", { type: "Password", username: "account", password: "secret", stay: false })).toBe(false);
        expect(processes).toHaveLength(1);
        expect(commitVersion).not.toHaveBeenCalled();
    });

    it("supersedes the running download once its child has exited", async () => {
        const { downloader, processes, start } = setup();
        const first = start();
        await flush();

        let release: () => void;
        processes[0].closed = new Promise<void>(resolve => { release = resolve; });
        const second = start();
        await flush();

        expect(first.completed).toBe(true);
        expect(processes[0].stopped).toBe(true);
        expect(second.events).toEqual([]);
        expect(processes).toHaveLength(1);

        release();
        await flush();

        expect(processes).toHaveLength(2);
        expect(second.events[0]).toMatchObject({ type: "Started", downloadId: "download-2" });
        expect(downloader.respond("download-1", { type: "Password", username: "account", password: "secret", stay: false })).toBe(false);
        expect(downloader.respond("download-2", { type: "Password", username: "account", password: "secret", stay: false })).toBe(true);
    });

    it("clears the remembered username and token", async () => {
        const { downloader, storage } = setup({ username: "account", refreshToken: "token" });
        expect(await downloader.session.exists()).toBe(true);
        expect(await downloader.session.username()).toBe("account");

        await downloader.session.clear();

        expect(await downloader.session.exists()).toBe(false);
        expect(storage.username).toBeUndefined();
        expect(await storage.loadSession("account")).toBeUndefined();
    });

    it("imports the legacy username only once", async () => {
        const { downloader } = setup();
        await downloader.session.importLegacyUsername("legacy");
        await downloader.session.importLegacyUsername("other");
        expect(await downloader.session.username()).toBe("legacy");
    });
});
