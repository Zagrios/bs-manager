import { BehaviorSubject, Observable, Subject, of } from "rxjs";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { BSVersion } from "shared/bs-version.interface";

jest.mock("renderer", () => ({ logRenderError: jest.fn() }));
jest.mock("renderer/services/ipc.service", () => ({ IpcService: { getInstance: jest.fn() } }));
jest.mock("renderer/services/modale.service", () => ({
    ModalExitCode: { COMPLETED: 0, CANCELED: 2 },
    ModalService: { getInstance: jest.fn() },
}));
jest.mock("renderer/services/notification.service", () => ({ NotificationService: { getInstance: jest.fn() } }));
jest.mock("renderer/services/progress-bar.service", () => ({ ProgressBarService: { getInstance: jest.fn() } }));
jest.mock("renderer/components/modal/modal-types/edit-version-modal.component", () => ({ EditVersionModal: jest.fn() }));
jest.mock("renderer/components/modal/modal-types/import-version-modal.component", () => ({ ImportVersionModal: jest.fn() }));

type VersionManagerInternals = {
    ipcService: { sendV2: jest.Mock<Observable<BSVersion[]>, [string, unknown?]> };
    availableVersionsRefreshPromise: Promise<BSVersion[]> | null;
    installedVersionsRequestPromise: Promise<BSVersion[]> | null;
    installedVersionsRescanQueued: boolean;
    installedVersions$: BehaviorSubject<BSVersion[]>;
    availableVersions$: BehaviorSubject<BSVersion[]>;
};

const LOCAL_VERSIONS: BSVersion[] = [
    { BSVersion: "1.40.8", ReleaseDate: "2025-04-10" },
];

const METADATA_UPDATED_VERSIONS: BSVersion[] = [
    { BSVersion: "1.40.8", ReleaseDate: "2025-04-11", recommended: true },
];

const REMOTE_VERSIONS: BSVersion[] = [
    ...LOCAL_VERSIONS,
    { BSVersion: "1.41.0", ReleaseDate: "2025-05-08" },
];

function createService(sendV2: jest.Mock): BSVersionManagerService {
    const service = Object.create(BSVersionManagerService.prototype) as BSVersionManagerService;
    Object.assign(service as unknown as VersionManagerInternals, {
        ipcService: { sendV2 },
        availableVersionsRefreshPromise: null,
        installedVersionsRequestPromise: null,
        installedVersionsRescanQueued: false,
        installedVersions$: new BehaviorSubject<BSVersion[]>([]),
        availableVersions$: new BehaviorSubject<BSVersion[]>([]),
    });
    return service;
}

function callsFor(sendV2: jest.Mock, channel: string): unknown[][] {
    return sendV2.mock.calls.filter(([calledChannel]) => calledChannel === channel);
}

describe("renderer BSVersionManagerService catalog refresh", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("shares one available-version promise, including after the local emission", async () => {
        const available = new Subject<BSVersion[]>();
        const sendV2 = jest.fn((channel: string) => {
            if (channel === "bs-version.get-version-dict") return available.asObservable();
            throw new Error(`Unexpected IPC channel: ${channel}`);
        });
        const service = createService(sendV2);
        const published: BSVersion[][] = [];
        const publication = service.availableVersions$.subscribe(versions => published.push(versions));

        const firstCall = service.refreshAvailableVersions();
        available.next(LOCAL_VERSIONS);
        const lateCall = service.refreshAvailableVersions();

        expect(lateCall).toBe(firstCall);
        expect(callsFor(sendV2, "bs-version.get-version-dict")).toEqual([
            ["bs-version.get-version-dict", { refresh: true }],
        ]);

        available.next(METADATA_UPDATED_VERSIONS);
        available.complete();

        await expect(Promise.all([firstCall, lateCall])).resolves.toEqual([
            METADATA_UPDATED_VERSIONS,
            METADATA_UPDATED_VERSIONS,
        ]);
        expect(published).toEqual([[], LOCAL_VERSIONS, METADATA_UPDATED_VERSIONS]);
        expect(callsFor(sendV2, "bs-version.installed-versions")).toHaveLength(0);

        publication.unsubscribe();
    });

    it("does not rescan installed versions for a metadata-only catalog update", async () => {
        const available = new Subject<BSVersion[]>();
        const sendV2 = jest.fn((channel: string) => {
            if (channel === "bs-version.get-version-dict") return available.asObservable();
            throw new Error(`Unexpected IPC channel: ${channel}`);
        });
        const service = createService(sendV2);
        const refresh = service.refreshAvailableVersions();

        available.next(LOCAL_VERSIONS);
        available.next(METADATA_UPDATED_VERSIONS);
        available.complete();

        await expect(refresh).resolves.toBe(METADATA_UPDATED_VERSIONS);
        expect(callsFor(sendV2, "bs-version.installed-versions")).toHaveLength(0);
    });

    it("rescans installed versions when the ordered version sequence changes", async () => {
        const available = new Subject<BSVersion[]>();
        const sendV2 = jest.fn((channel: string) => {
            if (channel === "bs-version.get-version-dict") return available.asObservable();
            if (channel === "bs-version.installed-versions") return of([]);
            throw new Error(`Unexpected IPC channel: ${channel}`);
        });
        const service = createService(sendV2);
        const refresh = service.refreshAvailableVersions();

        available.next(LOCAL_VERSIONS);
        available.next(REMOTE_VERSIONS);
        available.complete();

        await expect(refresh).resolves.toBe(REMOTE_VERSIONS);
        expect(callsFor(sendV2, "bs-version.installed-versions")).toHaveLength(1);
    });

    it("does not rescan installed versions after a single catalog emission", async () => {
        const sendV2 = jest.fn((channel: string) => {
            if (channel === "bs-version.get-version-dict") return of(LOCAL_VERSIONS);
            throw new Error(`Unexpected IPC channel: ${channel}`);
        });
        const service = createService(sendV2);

        await expect(service.refreshAvailableVersions()).resolves.toBe(LOCAL_VERSIONS);
        expect(callsFor(sendV2, "bs-version.installed-versions")).toHaveLength(0);
    });

    it("shares an installed-version promise with a caller arriving after the IPC value", async () => {
        const installed = new Subject<BSVersion[]>();
        const sendV2 = jest.fn((channel: string) => {
            if (channel === "bs-version.installed-versions") return installed.asObservable();
            throw new Error(`Unexpected IPC channel: ${channel}`);
        });
        const service = createService(sendV2);
        const input = [
            { BSVersion: "1.39.0", ReleaseDate: "1" },
            { BSVersion: "1.40.0", ReleaseDate: "2", steam: true },
            { BSVersion: "1.39.1", ReleaseDate: "3" },
            { BSVersion: "1.39.1", ReleaseDate: "3" },
        ] as BSVersion[];
        const originalOrder = [...input];

        const firstCall = service.askInstalledVersions();
        installed.next(input);
        const lateCall = service.askInstalledVersions();

        expect(lateCall).toBe(firstCall);
        installed.complete();

        const expected = [input[1], input[2], input[0]];
        await expect(Promise.all([firstCall, lateCall])).resolves.toEqual([expected, expected]);
        expect(service.installedVersions$.value).toEqual(expected);
        expect(input).toEqual(originalOrder);
        expect(callsFor(sendV2, "bs-version.installed-versions")).toHaveLength(1);
    });

    it("queues one rescan when a catalog update arrives during an installed-version scan", async () => {
        const available = new Subject<BSVersion[]>();
        const firstInstalledScan = new Subject<BSVersion[]>();
        const queuedInstalledScan = new Subject<BSVersion[]>();
        const installedScans = [firstInstalledScan, queuedInstalledScan];
        const sendV2 = jest.fn((channel: string) => {
            if (channel === "bs-version.get-version-dict") return available.asObservable();
            if (channel === "bs-version.installed-versions") {
                const scan = installedScans.shift();
                if (scan) return scan.asObservable();
            }
            throw new Error(`Unexpected IPC channel: ${channel}`);
        });
        const service = createService(sendV2);

        const activeScan = service.askInstalledVersions();
        const refresh = service.refreshAvailableVersions();

        available.next(LOCAL_VERSIONS);
        available.next(REMOTE_VERSIONS);
        available.complete();

        await expect(refresh).resolves.toBe(REMOTE_VERSIONS);
        expect(callsFor(sendV2, "bs-version.installed-versions")).toHaveLength(1);

        firstInstalledScan.next([]);
        firstInstalledScan.complete();
        await expect(activeScan).resolves.toEqual([]);

        expect(callsFor(sendV2, "bs-version.installed-versions")).toHaveLength(2);
        const queuedScan = service.askInstalledVersions();
        queuedInstalledScan.next([]);
        queuedInstalledScan.complete();
        await expect(queuedScan).resolves.toEqual([]);

        expect(callsFor(sendV2, "bs-version.installed-versions")).toHaveLength(2);
    });

    it("runs a queued rescan even when the active installed-version scan fails", async () => {
        const available = new Subject<BSVersion[]>();
        const failedInstalledScan = new Subject<BSVersion[]>();
        const queuedInstalledScan = new Subject<BSVersion[]>();
        const installedScans = [failedInstalledScan, queuedInstalledScan];
        const sendV2 = jest.fn((channel: string) => {
            if (channel === "bs-version.get-version-dict") return available.asObservable();
            if (channel === "bs-version.installed-versions") {
                const scan = installedScans.shift();
                if (scan) return scan.asObservable();
            }
            throw new Error(`Unexpected IPC channel: ${channel}`);
        });
        const service = createService(sendV2);

        const activeScan = service.askInstalledVersions();
        const refresh = service.refreshAvailableVersions();
        available.next(LOCAL_VERSIONS);
        available.next(REMOTE_VERSIONS);
        available.complete();
        await expect(refresh).resolves.toBe(REMOTE_VERSIONS);

        failedInstalledScan.error(new Error("initial scan failed"));
        await expect(activeScan).rejects.toThrow("initial scan failed");
        expect(callsFor(sendV2, "bs-version.installed-versions")).toHaveLength(2);

        const queuedScan = service.askInstalledVersions();
        queuedInstalledScan.next(LOCAL_VERSIONS);
        queuedInstalledScan.complete();

        await expect(queuedScan).resolves.toEqual(LOCAL_VERSIONS);
        expect(service.installedVersions$.value).toEqual(LOCAL_VERSIONS);
    });

    it("clears a failed available-version single-flight so the next call retries", async () => {
        const failedRefresh = new Subject<BSVersion[]>();
        const refreshes: Observable<BSVersion[]>[] = [failedRefresh.asObservable(), of(LOCAL_VERSIONS)];
        const sendV2 = jest.fn((channel: string) => {
            if (channel === "bs-version.get-version-dict") {
                const refresh = refreshes.shift();
                if (refresh) return refresh;
            }
            throw new Error(`Unexpected IPC channel: ${channel}`);
        });
        const service = createService(sendV2);
        const firstCall = service.refreshAvailableVersions();

        failedRefresh.error(new Error("IPC failed"));
        await expect(firstCall).rejects.toThrow("IPC failed");
        await expect(service.refreshAvailableVersions()).resolves.toBe(LOCAL_VERSIONS);

        expect(callsFor(sendV2, "bs-version.get-version-dict")).toHaveLength(2);
    });

    it("clears a failed installed-version single-flight so the next call retries", async () => {
        const failedScan = new Subject<BSVersion[]>();
        const scans: Observable<BSVersion[]>[] = [failedScan.asObservable(), of(LOCAL_VERSIONS)];
        const sendV2 = jest.fn((channel: string) => {
            if (channel === "bs-version.installed-versions") {
                const scan = scans.shift();
                if (scan) return scan;
            }
            throw new Error(`Unexpected IPC channel: ${channel}`);
        });
        const service = createService(sendV2);
        const firstCall = service.askInstalledVersions();

        failedScan.error(new Error("IPC failed"));
        await expect(firstCall).rejects.toThrow("IPC failed");
        await expect(service.askInstalledVersions()).resolves.toEqual(LOCAL_VERSIONS);

        expect(callsFor(sendV2, "bs-version.installed-versions")).toHaveLength(2);
    });
});
