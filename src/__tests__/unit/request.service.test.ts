import { EventEmitter } from "events";
import { createWriteStream } from "fs";
import { net } from "electron";
import got from "got";
import { lastValueFrom } from "rxjs";
import { RequestService } from "main/services/request.service";

jest.mock("electron", () => ({
    app: { getVersion: jest.fn(() => "1.0.0-test") },
    net: { request: jest.fn() },
}));
jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("fs", () => ({
    ...jest.requireActual("fs"),
    createWriteStream: jest.fn(),
}));
jest.mock("main/helpers/fs.helpers", () => ({ deleteFileSync: jest.fn() }));
jest.mock("got", () => {
    const mockedGot = jest.fn();
    Object.assign(mockedGot, { stream: jest.fn() });
    return { __esModule: true, default: mockedGot };
});

type MockElectronRequest = EventEmitter & {
    abort: jest.Mock;
    end: jest.Mock;
};

type MockElectronResponse = EventEmitter & {
    headers: Record<string, string | string[]>;
    pause: jest.Mock;
    resume: jest.Mock;
    statusCode: number;
};

type MockWriteStream = EventEmitter & {
    destroy: jest.Mock;
    destroyed: boolean;
    end: jest.Mock;
    write: jest.Mock;
};

type RequestServiceInternals = {
    preferredFamilyCache: Record<string, number>;
    requestData: (url: string, family: number) => Promise<{ data: unknown; headers: Record<string, string> }>;
};

const netRequestMock = net.request as unknown as jest.Mock;
const createWriteStreamMock = createWriteStream as unknown as jest.Mock;
const gotStreamMock = got.stream as unknown as jest.Mock;

function createElectronRequest(): MockElectronRequest {
    const request = Object.assign(new EventEmitter(), {
        abort: jest.fn(),
        end: jest.fn(),
    });
    netRequestMock.mockReturnValue(request);
    return request;
}

function createElectronResponse(
    headers: Record<string, string | string[]> = {},
    statusCode = 200
): MockElectronResponse {
    return Object.assign(new EventEmitter(), {
        headers,
        pause: jest.fn(),
        resume: jest.fn(),
        statusCode,
    });
}

function createMockWriteStream(writeResults: boolean[]): MockWriteStream {
    const file = new EventEmitter() as MockWriteStream;
    file.destroyed = false;
    file.write = jest.fn(() => writeResults.shift() ?? true);
    file.end = jest.fn();
    file.destroy = jest.fn(() => {
        file.destroyed = true;
    });
    return file;
}

function createGotStream(): EventEmitter & { destroy: jest.Mock } {
    return Object.assign(new EventEmitter(), { destroy: jest.fn() });
}

describe("RequestService network and memory behavior", () => {
    const service = RequestService.getInstance();
    const internals = service as unknown as RequestServiceInternals;

    beforeEach(() => {
        jest.clearAllMocks();
        netRequestMock.mockReset();
        createWriteStreamMock.mockReset();
        gotStreamMock.mockReset();
        internals.preferredFamilyCache = {};
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("concatenates an Electron JSON response only once after all chunks arrive", async () => {
        const request = createElectronRequest();
        const response = createElectronResponse({ "content-type": "application/json" });
        const concat = jest.spyOn(Buffer, "concat");

        const resultPromise = service.getJSON<{ value: string }>("https://beatmods.com/api/test");
        request.emit("response", response);
        response.emit("data", Buffer.from('{"value":'));
        response.emit("data", Buffer.from('"ok"}'));
        expect(concat).not.toHaveBeenCalled();
        response.emit("end");

        await expect(resultPromise).resolves.toEqual({
            data: { value: "ok" },
            headers: { "content-type": "application/json" },
        });
        expect(concat).toHaveBeenCalledTimes(1);
        expect(concat).toHaveBeenCalledWith(expect.any(Array), 14);
    });

    it("accumulates an Electron buffer linearly while preserving progress", async () => {
        const request = createElectronRequest();
        const response = createElectronResponse({ "content-length": "6" });
        const concat = jest.spyOn(Buffer, "concat");
        const snapshots: Array<{ current: number; total: number; data: Buffer | null }> = [];
        const completion = new Promise<void>((resolve, reject) => {
            service.downloadBuffer("https://cdn.beatmods.com/file").subscribe({
                next: progress => snapshots.push({
                    current: progress.current,
                    total: progress.total,
                    data: progress.data ? Buffer.from(progress.data) : progress.data,
                }),
                error: reject,
                complete: resolve,
            });
        });

        request.emit("response", response);
        response.emit("data", Buffer.from("abc"));
        response.emit("data", Buffer.from("def"));
        expect(concat).not.toHaveBeenCalled();
        expect(snapshots).toEqual([
            { current: 3, total: 6, data: null },
            { current: 6, total: 6, data: null },
        ]);
        response.emit("end");

        await completion;
        expect(snapshots).toEqual([
            { current: 3, total: 6, data: null },
            { current: 6, total: 6, data: null },
            { current: 6, total: 6, data: Buffer.from("abcdef") },
        ]);
        expect(concat).toHaveBeenCalledTimes(1);
        expect(concat).toHaveBeenCalledWith(expect.any(Array), 6);
    });

    it("accumulates a got buffer only once and keeps got progress values", async () => {
        const stream = createGotStream();
        gotStreamMock.mockReturnValue(stream);
        const concat = jest.spyOn(Buffer, "concat");

        const resultPromise = lastValueFrom(service.downloadBuffer("https://example.com/file"));
        const response = { headers: { "content-length": "6" } };
        stream.emit("response", response);
        stream.emit("data", Buffer.from("abc"));
        stream.emit("data", Buffer.from("def"));
        stream.emit("downloadProgress", { transferred: 5, total: 9 });
        expect(concat).not.toHaveBeenCalled();
        stream.emit("end");

        const result = await resultPromise;
        expect(result.data?.toString()).toBe("abcdef");
        expect(result.current).toBe(5);
        expect(result.total).toBe(9);
        expect(result.extra).toBe(response);
        expect(concat).toHaveBeenCalledTimes(1);
        expect(concat).toHaveBeenCalledWith(expect.any(Array), 6);
    });

    it("pauses an Electron response on file backpressure and completes after finish", async () => {
        const request = createElectronRequest();
        const response = createElectronResponse({ "content-length": "6" });
        const file = createMockWriteStream([false, true]);
        createWriteStreamMock.mockReturnValue(file);

        let settled = false;
        const resultPromise = lastValueFrom(service.downloadFile("https://beatmods.com/file", "C:/tmp/file.zip"));
        resultPromise.then(() => {
            settled = true;
        });

        request.emit("response", response);
        response.emit("data", Buffer.from("abc"));
        expect(response.pause).toHaveBeenCalledTimes(1);
        expect(response.resume).not.toHaveBeenCalled();

        file.emit("drain");
        expect(response.resume).toHaveBeenCalledTimes(1);

        response.emit("data", Buffer.from("def"));
        response.emit("end");
        await Promise.resolve();
        expect(settled).toBe(false);
        expect(file.end).toHaveBeenCalledTimes(1);

        file.emit("finish");
        const result = await resultPromise;
        expect(result.current).toBe(6);
        expect(result.total).toBe(6);
        expect(result.data).toBe("C:/tmp/file.zip");
        expect(file.write).toHaveBeenCalledTimes(2);
    });

    it("tries IPv4 then IPv6 and caches the first successful family", async () => {
        const requestData = jest.spyOn(internals, "requestData");
        requestData
            .mockRejectedValueOnce(new Error("IPv4 unavailable"))
            .mockResolvedValueOnce({ data: { ok: true }, headers: {} });

        await expect(service.getJSON("https://example.com/data")).resolves.toEqual({
            data: { ok: true },
            headers: {},
        });
        expect(requestData.mock.calls).toEqual([
            ["https://example.com/data", 4],
            ["https://example.com/data", 6],
        ]);
        expect(internals.preferredFamilyCache["example.com"]).toBe(6);
    });

    it("does not fall back when a cached family fails", async () => {
        internals.preferredFamilyCache["example.com"] = 6;
        const requestData = jest.spyOn(internals, "requestData").mockRejectedValue(new Error("offline"));

        await expect(service.getJSON("https://example.com/data")).rejects.toThrow(
            "Request failed: https://example.com/data"
        );
        expect(requestData.mock.calls).toEqual([["https://example.com/data", 6]]);
    });

    it("reads the cached family when a download Observable is subscribed", async () => {
        const stream = createGotStream();
        gotStreamMock.mockReturnValue(stream);
        const download = service.downloadBuffer("https://example.com/file");
        internals.preferredFamilyCache["example.com"] = 6;

        const resultPromise = lastValueFrom(download);
        expect(got.stream).toHaveBeenCalledWith(
            "https://example.com/file",
            expect.objectContaining({ dnsLookupIpVersion: 6 })
        );

        stream.emit("response", { headers: {} });
        stream.emit("end");
        await resultPromise;
    });
});
