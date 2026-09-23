import { EventEmitter } from "events";
import { PassThrough } from "stream";
import { lastValueFrom, toArray } from "rxjs";
import { BsDownloader, downloaderEnvironment } from "main/models/bs-downloader.class";
import { spawn } from "child_process";

jest.mock("main/services/utils.service", () => ({ UtilsService: { getInstance: () => ({ getAssetsScriptsPath: () => "/scripts" }) } }));
jest.mock("fs", () => ({ ...jest.requireActual("fs"), existsSync: () => true }));
jest.mock("child_process", () => ({ spawn: jest.fn() }));

function childProcess() {
    return Object.assign(new EventEmitter(), {
        stdout: new PassThrough(), stderr: new PassThrough(), stdin: new PassThrough(),
        exitCode: null as number | null, signalCode: null, kill: jest.fn(),
    });
}

const options = { app: 620980, depot: 620981, manifest: "18446744073709551615", directory: "/games/Beat Saber", username: "account", password: "secret" };
const line = (subType: string, data = "", type = "Info") => `${JSON.stringify({ version: 1, type, subType, data })}\n`;

describe("bs-downloader process adapter", () => {
    let child: ReturnType<typeof childProcess>;
    beforeEach(() => { child = childProcess(); jest.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>); });
    afterEach(() => { child.exitCode = 0; child.emit("close", 0, null); jest.clearAllMocks(); });

    it("sends secrets through stdin, preserves split UTF-8/JSON, and waits for successful close", async () => {
        const downloader = new BsDownloader(options, { BSVersion: "1.40.0", name: "version [custom]" });
        const received: unknown[] = [];
        downloader.$events().subscribe(event => received.push(event));
        const completed = lastValueFrom(downloader.$events().pipe(toArray()));
        expect(jest.mocked(spawn).mock.calls[0][1]).toEqual([]);
        expect(JSON.parse(child.stdin.read().toString()).options).toEqual(options);
        const message = Buffer.from(line("QRCode", "https://s.team/q/测试"));
        const split = message.indexOf(Buffer.from("测")) + 1;
        child.stdout.write(message.subarray(0, split));
        child.stdout.write(message.subarray(split));
        child.stdout.write(line("Progress", "50.25") + line("Finished"));
        expect(received).toHaveLength(3);
        child.exitCode = 0;
        child.emit("close", 0, null);
        expect((await completed).map(event => event.subType)).toEqual(["Start", "QRCode", "Progress", "Finished"]);
        expect(received[1]).toMatchObject({ data: "https://s.team/q/测试" });
    });

    it.each([0, 1])("rejects exit %s without Finished", async code => {
        const result = lastValueFrom(new BsDownloader(options, {}).$events());
        child.exitCode = code;
        child.emit("close", code, null);
        await expect(result).rejects.toMatchObject({ code: "NotCompleted" });
    });

    it("does not announce Finished on a failing exit", () => {
        const next = jest.fn();
        new BsDownloader(options, {}).$events().subscribe({ next, error: () => {} });
        child.stdout.write(line("Finished"));
        child.exitCode = 1;
        child.emit("close", 1, null);
        expect(next.mock.calls.some(([event]) => event.subType === "Finished")).toBe(false);
    });

    it.each(["not JSON\n", line("Progress", "1").replace('"version":1', '"version":2'), "x".repeat(128 * 1024 + 1)])("rejects malformed or oversized protocol responses", async response => {
        const result = lastValueFrom(new BsDownloader(options, {}).$events());
        child.stdout.write(response);
        await expect(result).rejects.toMatchObject({ code: "NotCompleted" });
    });

    it("keeps tokens out of UI events and logs, and stops gracefully", async () => {
        const saved = jest.fn().mockResolvedValue(undefined);
        const logger = { info: jest.fn(), warn: jest.fn() };
        const downloader = new BsDownloader(options, {}, logger, saved);
        const events: string[] = [];
        downloader.$events().subscribe(event => events.push(event.subType));
        child.stdout.write(`${JSON.stringify({ version: 1, type: "Session", subType: "Authenticated", data: { username: "account", refreshToken: "private-token" } })}\n`);
        expect(saved).toHaveBeenCalledWith({ username: "account", refreshToken: "private-token" });
        expect(events).toEqual(["Start"]);
        expect(logger.info).not.toHaveBeenCalled();
        const stopped = downloader.stop();
        expect(child.stdin.read().toString()).toContain('"command":"cancel"');
        child.exitCode = 0;
        child.emit("close", 0, null);
        await stopped;
        expect(child.kill).not.toHaveBeenCalled();
    });

    it("inherits proxy settings for the Rust child", () => {
        const previous = process.env.HTTPS_PROXY;
        process.env.HTTPS_PROXY = "http://127.0.0.1:7890";
        expect(downloaderEnvironment().HTTPS_PROXY).toBe(process.env.HTTPS_PROXY);
        if (previous === undefined) { delete process.env.HTTPS_PROXY; } else { process.env.HTTPS_PROXY = previous; }
    });

    it("logs bounded content error codes without arbitrary diagnostic payloads", () => {
        const logger = { info: jest.fn(), warn: jest.fn() };
        const next = jest.fn();
        const subscription = new BsDownloader(options, {}, logger).$events().subscribe({ next });
        child.stdout.write(line("ContentFailure", "steam.content.assembledHashMismatch", "Diagnostic"));
        child.stdout.write(line("ContentFailure", "private-token /private/path", "Diagnostic"));
        expect(logger.info).toHaveBeenCalledWith("bs-downloader content failure:", "steam.content.assembledHashMismatch");
        expect(JSON.stringify(logger.info.mock.calls)).not.toContain("private-token");
        expect(next).toHaveBeenCalledTimes(1);
        subscription.unsubscribe();
    });
});
