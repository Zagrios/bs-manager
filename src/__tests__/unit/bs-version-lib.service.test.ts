import { Observable, lastValueFrom, toArray } from "rxjs";
import { BSVersionLibService } from "main/services/bs-version-lib.service";
import { BSVersion } from "shared/bs-version.interface";

jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("main/services/utils.service", () => ({
    UtilsService: { getInstance: jest.fn(() => ({ getAssestsJsonsPath: jest.fn(() => "C:/assets") })) },
}));
jest.mock("main/services/request.service", () => ({
    RequestService: { getInstance: jest.fn(() => ({ getJSON: jest.fn() })) },
}));
jest.mock("main/services/static-configuration.service", () => ({
    StaticConfigurationService: { getInstance: jest.fn(() => ({ get: jest.fn(), set: jest.fn() })) },
}));

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
};

type JSONResponse = {
    data: unknown;
    headers: Record<string, string>;
};

type BSVersionLibInternals = {
    REMOTE_BS_VERSIONS_TIMEOUT: number;
    cachedVersions: BSVersion[] | null;
    loadPromise: Promise<BSVersion[]> | null;
    refreshPromise: Promise<BSVersion[] | null> | null;
    requestService: {
        getJSON: jest.Mock;
    };
    getLocalVersions: () => Promise<unknown>;
    updateLocalVersions: (versions: BSVersion[]) => Promise<void>;
};

const LOCAL_VERSIONS: BSVersion[] = [
    { BSVersion: "1.40.8", ReleaseDate: "2025-04-10" },
];

const REMOTE_VERSIONS: BSVersion[] = [
    { BSVersion: "1.40.8", ReleaseDate: "2025-04-10" },
    { BSVersion: "1.41.0", ReleaseDate: "2025-05-08" },
];

function deferred<T>(): Deferred<T> {
    let resolveDeferred: Deferred<T>["resolve"];
    let rejectDeferred: Deferred<T>["reject"];
    const promise = new Promise<T>((resolve, reject) => {
        resolveDeferred = resolve;
        rejectDeferred = reject;
    });

    return { promise, resolve: resolveDeferred, reject: rejectDeferred };
}

function nextEventLoopTurn(): Promise<void> {
    return new Promise(resolve => {
        setImmediate(resolve);
    });
}

function collect<T>(stream: Observable<T>): Promise<T[]> {
    return lastValueFrom(stream.pipe(toArray()));
}

function createHarness(
    localResult: unknown | Promise<unknown> = LOCAL_VERSIONS,
    remoteRequest: jest.Mock = jest.fn().mockResolvedValue({ data: REMOTE_VERSIONS, headers: {} })
) {
    (BSVersionLibService as any).instance = undefined;
    const service = BSVersionLibService.getInstance();
    const internals = service as unknown as BSVersionLibInternals;
    const getLocalVersions = jest.spyOn(internals, "getLocalVersions").mockReturnValue(Promise.resolve(localResult));
    const updateLocalVersions = jest.spyOn(internals, "updateLocalVersions").mockResolvedValue(undefined);
    internals.requestService = { getJSON: remoteRequest };

    return { service, internals, getLocalVersions, updateLocalVersions, remoteRequest };
}

describe("BSVersionLibService cache-first refresh", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (BSVersionLibService as any).instance = undefined;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        (BSVersionLibService as any).instance = undefined;
    });

    it("loads the cached catalog without starting a remote request", async () => {
        const { service, getLocalVersions, updateLocalVersions, remoteRequest } = createHarness();

        await expect(collect(service.getAvailableVersions$())).resolves.toEqual([LOCAL_VERSIONS]);
        await expect(service.getCachedVersions()).resolves.toBe(LOCAL_VERSIONS);
        expect(getLocalVersions).toHaveBeenCalledTimes(1);
        expect(remoteRequest).not.toHaveBeenCalled();
        expect(updateLocalVersions).not.toHaveBeenCalled();
    });

    it("normalizes an invalid local catalog without starting a remote request", async () => {
        const { service, updateLocalVersions, remoteRequest } = createHarness([{ ReleaseDate: "2025-04-10" }]);

        await expect(collect(service.getAvailableVersions$())).resolves.toEqual([[]]);
        await expect(service.getCachedVersions()).resolves.toEqual([]);
        expect(remoteRequest).not.toHaveBeenCalled();
        expect(updateLocalVersions).not.toHaveBeenCalled();
    });

    it("emits the local catalog before the next event-loop turn when the remote request never settles", async () => {
        const remoteRequest = jest.fn(() => new Promise<JSONResponse>(() => {
            // Intentionally left pending to reproduce the stalled network request.
        }));
        const { service, getLocalVersions, updateLocalVersions } = createHarness(LOCAL_VERSIONS, remoteRequest);
        const timeout = jest.spyOn(global, "setTimeout").mockImplementation((() => 0) as unknown as typeof setTimeout);
        const emissions: BSVersion[][] = [];
        let completed = false;
        let streamError: unknown;

        const subscription = service.getAvailableVersions$(true).subscribe({
            next: versions => emissions.push(versions),
            error: error => { streamError = error; },
            complete: () => { completed = true; },
        });

        try {
            await nextEventLoopTurn();

            expect(emissions).toEqual([LOCAL_VERSIONS]);
            expect(completed).toBe(false);
            expect(streamError).toBeUndefined();
            expect(getLocalVersions).toHaveBeenCalledTimes(1);
            expect(remoteRequest).toHaveBeenCalledTimes(1);
            expect(remoteRequest).toHaveBeenCalledWith(
                expect.any(String),
                { signal: expect.any(AbortSignal), retryLimit: 0 }
            );
            expect(updateLocalVersions).not.toHaveBeenCalled();
        } finally {
            subscription.unsubscribe();
            timeout.mockRestore();
        }
    });

    it("emits a successful remote refresh, updates memory, and persists it", async () => {
        const remote = deferred<JSONResponse>();
        const remoteRequest = jest.fn(() => remote.promise);
        const { service, getLocalVersions, updateLocalVersions } = createHarness(LOCAL_VERSIONS, remoteRequest);
        const emissionsPromise = collect(service.getAvailableVersions$(true));

        await nextEventLoopTurn();
        remote.resolve({ data: REMOTE_VERSIONS, headers: {} });

        await expect(emissionsPromise).resolves.toEqual([LOCAL_VERSIONS, REMOTE_VERSIONS]);
        await expect(service.getCachedVersions()).resolves.toBe(REMOTE_VERSIONS);
        expect(getLocalVersions).toHaveBeenCalledTimes(1);
        expect(remoteRequest).toHaveBeenCalledTimes(1);
        expect(updateLocalVersions).toHaveBeenCalledTimes(1);
        expect(updateLocalVersions).toHaveBeenCalledWith(REMOTE_VERSIONS);
    });

    it("deduplicates concurrent streams, the local read, and the remote request", async () => {
        const local = deferred<BSVersion[]>();
        const remote = deferred<JSONResponse>();
        const remoteRequest = jest.fn(() => remote.promise);
        const { service, getLocalVersions, updateLocalVersions } = createHarness(local.promise, remoteRequest);

        const firstStream = collect(service.getAvailableVersions$(true));
        const secondStream = collect(service.getAvailableVersions$(true));

        expect(getLocalVersions).toHaveBeenCalledTimes(1);
        expect(remoteRequest).not.toHaveBeenCalled();

        local.resolve(LOCAL_VERSIONS);
        await nextEventLoopTurn();

        expect(remoteRequest).toHaveBeenCalledTimes(1);
        remote.resolve({ data: REMOTE_VERSIONS, headers: {} });

        await expect(Promise.all([firstStream, secondStream])).resolves.toEqual([
            [LOCAL_VERSIONS, REMOTE_VERSIONS],
            [LOCAL_VERSIONS, REMOTE_VERSIONS],
        ]);
        expect(getLocalVersions).toHaveBeenCalledTimes(1);
        expect(remoteRequest).toHaveBeenCalledTimes(1);
        expect(updateLocalVersions).toHaveBeenCalledTimes(1);
    });

    it("recovers from a local read failure with a valid remote catalog", async () => {
        const localError = Promise.reject<unknown>(new Error("corrupted local catalog"));
        const { service, getLocalVersions, updateLocalVersions, remoteRequest } = createHarness(localError);

        await expect(collect(service.getAvailableVersions$(true))).resolves.toEqual([
            [],
            REMOTE_VERSIONS,
        ]);
        await expect(service.getCachedVersions()).resolves.toBe(REMOTE_VERSIONS);
        expect(getLocalVersions).toHaveBeenCalledTimes(1);
        expect(remoteRequest).toHaveBeenCalledTimes(1);
        expect(updateLocalVersions).toHaveBeenCalledWith(REMOTE_VERSIONS);
    });

    it.each([
        ["a network error", () => Promise.reject(new Error("offline"))],
        ["an empty remote catalog", () => Promise.resolve({ data: [], headers: {} })],
        ["an invalid remote catalog", () => Promise.resolve({ data: [{}], headers: {} })],
        ["an unchanged remote catalog", () => Promise.resolve({ data: LOCAL_VERSIONS.map(version => ({ ...version })), headers: {} })],
    ])("keeps only the local emission without persistence after %s", async (_label, request) => {
        const remoteRequest = jest.fn(request);
        const { service, updateLocalVersions } = createHarness(LOCAL_VERSIONS, remoteRequest);

        await expect(collect(service.getAvailableVersions$(true))).resolves.toEqual([LOCAL_VERSIONS]);
        await expect(service.getCachedVersions()).resolves.toBe(LOCAL_VERSIONS);
        expect(updateLocalVersions).not.toHaveBeenCalled();
    });

    it("aborts a timed-out refresh, then completes with only the local catalog", async () => {
        const remoteRequest = jest.fn((_url: string, options: { signal: AbortSignal }) => (
            new Promise<JSONResponse>((_resolve, reject) => {
                options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
            })
        ));
        const { service, internals, updateLocalVersions } = createHarness(LOCAL_VERSIONS, remoteRequest);
        internals.REMOTE_BS_VERSIONS_TIMEOUT = 0;

        await expect(collect(service.getAvailableVersions$(true))).resolves.toEqual([LOCAL_VERSIONS]);
        expect(remoteRequest.mock.calls[0][1].signal.aborted).toBe(true);
        expect(updateLocalVersions).not.toHaveBeenCalled();
    });

    it("keeps the remote emission and memory cache when persistence fails", async () => {
        const remoteRequest = jest.fn().mockResolvedValue({ data: REMOTE_VERSIONS, headers: {} });
        const { service, updateLocalVersions } = createHarness(LOCAL_VERSIONS, remoteRequest);
        updateLocalVersions.mockRejectedValue(new Error("read-only installation"));

        await expect(collect(service.getAvailableVersions$(true))).resolves.toEqual([
            LOCAL_VERSIONS,
            REMOTE_VERSIONS,
        ]);
        await expect(service.getCachedVersions()).resolves.toBe(REMOTE_VERSIONS);
        expect(updateLocalVersions).toHaveBeenCalledTimes(1);
        expect(updateLocalVersions).toHaveBeenCalledWith(REMOTE_VERSIONS);
    });
});
