import path from "node:path";
import fs from "node:fs";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { Observable, ReplaySubject, Subscriber, share } from "rxjs";
import { UtilsService } from "main/services/utils.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { DepotDownloaderErrorEvent, DepotDownloaderEvent, DepotDownloaderEventType, DepotDownloaderInfoEvent, DepotDownloaderWarningEvent } from "shared/models/bs-version-download/depot-downloader.model";

export interface SteamDownloadSession {
    username: string;
    refreshToken: string;
}

export interface BsDownloaderOptions {
    app: number;
    depot: number;
    manifest: string;
    directory: string;
    username?: string;
    password?: string;
    refreshToken?: string;
    qr?: boolean;
}

interface Logger {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
}

const PROTOCOL_VERSION = 1;
const MAX_LINE_LENGTH = 128 * 1024;
const DIAGNOSTIC_STAGES = new Set(["Authentication", "SteamConnection", "DepotAuthorization", "ManifestAuthorization", "CDN", "CDNAuthorization", "CDNRetry", "ContentFailure"]);
const EVENT_TYPES = {
    [DepotDownloaderEventType.Info]: new Set<string>(Object.values(DepotDownloaderInfoEvent)),
    [DepotDownloaderEventType.Error]: new Set<string>(Object.values(DepotDownloaderErrorEvent)),
    [DepotDownloaderEventType.Warning]: new Set<string>(Object.values(DepotDownloaderWarningEvent)),
};

function logDiagnostic(subType: string, data: unknown, logger?: Logger): void {
    if (!DIAGNOSTIC_STAGES.has(subType)) { return; }
    logger?.info("bs-downloader stage:", subType);
    if (subType === "ContentFailure" && typeof data === "string" && /^steam\.(content|format|cache|verification)\.[a-zA-Z]{1,64}$/.test(data)) {
        logger?.info("bs-downloader content failure:", data);
    }
    if (subType === "CDNRetry" && typeof data === "string" && EVENT_TYPES.Error.has(data)) {
        logger?.info("bs-downloader CDN failure:", data);
    }
    if (subType === "CDN" && data && typeof data === "object") {
        const { host } = data as Record<string, unknown>;
        if (typeof host === "string" && /^[a-zA-Z0-9.-]{1,253}$/.test(host)) {
            logger?.info("bs-downloader CDN host:", host);
        }
    }
}

export class BsDownloader {
    private process: ChildProcessWithoutNullStreams | null = null;
    private subscriber: Subscriber<DepotDownloaderEvent> | null = null;
    private readonly events: Observable<DepotDownloaderEvent>;
    private closed: Promise<void> = Promise.resolve();

    public constructor(options: BsDownloaderOptions, echoStartData: unknown, logger?: Logger, onSession?: (session: SteamDownloadSession) => Promise<void>) {
        const executable = path.join(UtilsService.getInstance().getAssetsScriptsPath(), process.platform === "win32" ? "bs-downloader.exe" : "bs-downloader");
        if (!fs.existsSync(executable)) {
            throw new CustomError("bs-downloader executable not found", process.platform === "win32" ? DepotDownloaderErrorEvent.ExeNotFoundWindows : DepotDownloaderErrorEvent.ExeNotFoundLinux);
        }

        this.events = new Observable<DepotDownloaderEvent>(subscriber => {
            this.subscriber = subscriber;
            const child = spawn(executable, [], { windowsHide: true, env: downloaderEnvironment() });
            this.process = child;
            let resolveClosed: () => void;
            this.closed = new Promise(resolve => { resolveClosed = resolve; });
            const decoder = new StringDecoder("utf8");
            let buffer = "";
            let finished: DepotDownloaderEvent | null = null;
            let killTimer: ReturnType<typeof setTimeout> | undefined;
            const fail = (message: string) => subscriber.error(new CustomError(message, DepotDownloaderErrorEvent.NotCompleted));

            const acceptLine = (line: string) => {
                let event: Record<string, unknown>;
                try { event = JSON.parse(line); } catch { fail("Invalid bs-downloader response"); return; }
                if (event?.version !== PROTOCOL_VERSION || typeof event.type !== "string" || typeof event.subType !== "string") {
                    fail("Unsupported bs-downloader protocol");
                    return;
                }
                if (event.type === "Session" && event.subType === "Authenticated") {
                    const session = event.data as Partial<SteamDownloadSession>;
                    if (session && typeof session.username === "string" && typeof session.refreshToken === "string") {
                        onSession?.({ username: session.username, refreshToken: session.refreshToken }).catch(() => logger?.warn("bs-downloader: could not save Steam session"));
                    } else { fail("Invalid bs-downloader session response"); }
                    return;
                }
                if (event.type === "Diagnostic") {
                    logDiagnostic(event.subType, event.data, logger);
                    return;
                }
                const type = event.type as DepotDownloaderEventType;
                if (!Object.hasOwn(EVENT_TYPES, type) || !EVENT_TYPES[type].has(event.subType) || typeof event.data !== "string") {
                    fail("Invalid bs-downloader event");
                    return;
                }
                const mapped = { type, subType: event.subType, data: event.data } as DepotDownloaderEvent;
                if (type === DepotDownloaderEventType.Info && event.subType === DepotDownloaderInfoEvent.Finished) {
                    finished = mapped;
                } else { subscriber.next(mapped); }
            };

            subscriber.next({ type: DepotDownloaderEventType.Info, subType: DepotDownloaderInfoEvent.Start, data: JSON.stringify(echoStartData) });
            child.stdout.on("data", (data: Buffer) => {
                buffer += decoder.write(data);
                while (!subscriber.closed) {
                    const newline = buffer.indexOf("\n");
                    if (newline === -1) { break; }
                    if (newline > MAX_LINE_LENGTH) { fail("bs-downloader response too large"); return; }
                    const line = buffer.slice(0, newline).trim();
                    buffer = buffer.slice(newline + 1);
                    if (line) { acceptLine(line); }
                }
                if (buffer.length > MAX_LINE_LENGTH) { fail("bs-downloader response too large"); }
            });
            child.stderr.resume();
            child.on("error", () => { resolveClosed(); fail("Could not run bs-downloader"); });
            child.stdin.on("error", () => fail("Could not communicate with bs-downloader"));
            child.stdout.on("error", () => fail("Could not read bs-downloader response"));
            child.stderr.on("error", () => fail("Could not read bs-downloader diagnostics"));
            child.on("close", (code, signal) => {
                resolveClosed();
                if (killTimer) { clearTimeout(killTimer); }
                if (this.process === child) { this.process = null; }
                buffer += decoder.end();
                if (subscriber.closed) { return; }
                if (code !== 0 || signal || buffer.trim() || !finished) {
                    fail("bs-downloader exited without a completed download");
                    return;
                }
                subscriber.next(finished);
                subscriber.complete();
            });
            child.stdin.write(`${JSON.stringify({ command: "start", version: PROTOCOL_VERSION, options })}\n`);

            return () => {
                if (child.exitCode === null && child.signalCode === null) {
                    if (child.stdin.writable && !child.stdin.destroyed) { child.stdin.end(`${JSON.stringify({ command: "cancel" })}\n`); }
                    killTimer = setTimeout(() => child.kill(), 5000);
                    killTimer.unref();
                }
            };
        }).pipe(share({ connector: () => new ReplaySubject(1), resetOnComplete: false, resetOnError: false }));
    }

    public $events(): Observable<DepotDownloaderEvent> { return this.events; }

    public sendInput(value: string): boolean {
        if (!this.process?.stdin.writable || this.process.stdin.destroyed) { return false; }
        return this.process.stdin.write(`${JSON.stringify({ command: "input", value })}\n`);
    }

    public stop(): Promise<void> {
        this.subscriber?.complete();
        return this.closed;
    }
}
export function downloaderEnvironment(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    const agent = (global as typeof global & { GLOBAL_AGENT?: { HTTPS_PROXY?: string; HTTP_PROXY?: string; NO_PROXY?: string } }).GLOBAL_AGENT;
    if (agent?.HTTPS_PROXY || agent?.HTTP_PROXY) {
        env.HTTPS_PROXY = agent.HTTPS_PROXY || agent.HTTP_PROXY;
        env.HTTP_PROXY = agent.HTTP_PROXY || agent.HTTPS_PROXY;
        env.https_proxy = env.HTTPS_PROXY;
        env.http_proxy = env.HTTP_PROXY;
        if (agent.NO_PROXY) {
            env.NO_PROXY = agent.NO_PROXY.split(";").filter(host => host !== "<local>").map(host => host.replace(/^\*\./, ".")).join(",");
            env.no_proxy = env.NO_PROXY;
        }
    }
    return env;
}
