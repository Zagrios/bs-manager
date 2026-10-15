import { Observable, Subscriber, Subscription, concatMap, noop } from "rxjs";
import type { BsDownloaderOptions, SteamDownloadSession } from "main/models/bs-downloader.class";
import type { SteamSessionStorage } from "./steam-download-session";
import { BSVersion } from "shared/bs-version.interface";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { DepotDownloaderErrorEvent, DepotDownloaderEvent, DepotDownloaderEventType, DepotDownloaderInfoEvent, DepotDownloaderWarningEvent } from "shared/models/bs-version-download/depot-downloader.model";
import { SteamDownloadAnswer, SteamDownloadEvent, SteamDownloadRequest } from "shared/models/bs-version-download/steam-download.model";

export interface SteamDownloadProcess {
    $events(): Observable<DepotDownloaderEvent>;
    sendInput(value: string): boolean;
    stop(): Promise<void>;
}

export type SteamDownloadProcessOptions = Omit<BsDownloaderOptions, "app" | "depot">;

export interface SteamDownloaderDependencies {
    createProcess(options: SteamDownloadProcessOptions, version: BSVersion, onSession?: (session: SteamDownloadSession) => Promise<void>): SteamDownloadProcess;
    resolveDestination(request: SteamDownloadRequest): Promise<{ directory: string; version: BSVersion }>;
    commitVersion(version: BSVersion): Promise<void>;
    storage: SteamSessionStorage;
    createId(): string;
    logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };
}

interface Run {
    readonly id: string;
    readonly subscriber: Subscriber<SteamDownloadEvent>;
    ended: boolean;
    process?: SteamDownloadProcess;
    onPassword?: (answer: Extract<SteamDownloadAnswer, { type: "Password" }>) => void;
}

interface Attempt {
    readonly process?: SteamDownloadProcess;
    readonly done: Promise<void>;
}

const PASSWORD_REQUIRED = "PasswordRequired";

export class SteamDownloader {

    private current?: Run;
    private released: Promise<void> = Promise.resolve();
    private sessionWrites: Promise<void> = Promise.resolve();

    public constructor(private readonly deps: SteamDownloaderDependencies) {}

    public readonly session = {
        exists: async (): Promise<boolean> => !!(await this.session.username()),
        username: async (): Promise<string | undefined> => {
            await this.sessionWrites;
            return this.deps.storage.loadUsername();
        },
        clear: (): Promise<void> => this.writeSession(() => this.deps.storage.clear()),
        importLegacyUsername: (username: string): Promise<void> => this.writeSession(async () => {
            if (!username || await this.deps.storage.loadUsername()) { return; }
            await this.deps.storage.saveUsername(username);
        }),
    };

    public download(request: SteamDownloadRequest): Observable<SteamDownloadEvent> {
        return new Observable<SteamDownloadEvent>(subscriber => {
            const run: Run = { id: this.deps.createId(), subscriber, ended: false };
            const previous = this.current;
            this.current = run;
            if (previous) { this.endRun(previous); }

            this.runDownload(run, request).then(() => this.endRun(run), async (error: unknown) => {
                if (run.ended) { return; }
                this.deps.logger?.warn("Steam download failed", error);
                await this.session.clear().catch(noop);
                this.endRun(run, toDownloadError(error));
            });

            return () => this.endRun(run);
        });
    }

    public respond(downloadId: string, answer: SteamDownloadAnswer): boolean {
        const run = this.current;
        if (!run || run.id !== downloadId) { return false; }

        if (answer.type === "Password") {
            if (!run.onPassword) { return false; }
            run.onPassword(answer);
            return true;
        }

        return !!run.process?.sendInput(answer.code);
    }

    public stop(): Promise<void> {
        if (this.current) { this.endRun(this.current); }
        return this.released;
    }

    private writeSession(write: () => Promise<void>): Promise<void> {
        const result = this.sessionWrites.then(write);
        this.sessionWrites = result.catch(noop);
        return result;
    }

    private rememberSession(session: SteamDownloadSession): Promise<void> {
        return this.writeSession(async () => {
            await this.deps.storage.saveUsername(session.username);
            await this.deps.storage.saveSession(session);
        });
    }

    private endRun(run: Run, error?: CustomError): void {
        if (run.ended) { return; }
        run.ended = true;
        run.onPassword = undefined;
        if (this.current === run) { this.current = undefined; }

        const { process } = run;
        if (process) {
            const stopped = process.stop().catch(noop);
            this.released = Promise.all([this.released, stopped]).then(noop);
        }

        if (error) { run.subscriber.error(error); }
        else { run.subscriber.complete(); }
    }

    private emit(run: Run, event: SteamDownloadEvent): void {
        if (!run.ended) { run.subscriber.next(event); }
    }

    private async runDownload(run: Run, request: SteamDownloadRequest): Promise<void> {
        await this.released;
        if (run.ended) { return; }

        const { directory, version } = await this.deps.resolveDestination(request);
        if (run.ended) { return; }

        this.emit(run, { type: "Started", downloadId: run.id, version, isVerification: !!request.isVerification });

        const target: SteamDownloadProcessOptions = { directory, manifest: String(request.bsVersion.BSManifest) };

        if (await this.downloadWithRememberedSession(run, target, version) || run.ended) {
            return;
        }

        await this.downloadWithLogin(run, target, version);
    }

    private async downloadWithRememberedSession(run: Run, target: SteamDownloadProcessOptions, version: BSVersion): Promise<boolean> {
        const username = await this.session.username();
        if (!username) { return false; }

        const saved = await this.deps.storage.loadSession(username);
        if (!saved) {
            await this.session.clear();
            return false;
        }

        const attempt = await this.startAttempt(run, { ...target, username: saved.username, refreshToken: saved.refreshToken }, version, { remember: true, passwordFails: true });

        try {
            await attempt.done;
            return true;
        } catch (error) {
            if (run.ended) { return true; }
            this.deps.logger?.info("Steam remembered session did not work, asking to log in", (error as CustomError)?.code);
            await this.session.clear().catch(noop);
            return false;
        }
    }

    private async downloadWithLogin(run: Run, target: SteamDownloadProcessOptions, version: BSVersion): Promise<void> {
        const password = new Promise<Extract<SteamDownloadAnswer, { type: "Password" }>>(resolve => { run.onPassword = resolve; });
        const qr = await this.startAttempt(run, { ...target, qr: true }, version, { remember: false });
        if (run.ended) { return; }

        this.emit(run, { type: "NeedsLogin" });

        const answer = await Promise.race([qr.done.then(() => undefined), password]);
        run.onPassword = undefined;

        if (!answer || run.ended) {
            return;
        }

        qr.done.catch(noop);

        const attempt = await this.startAttempt(run, { ...target, username: answer.username, password: answer.password }, version, { remember: answer.stay });
        await attempt.done;
    }

    private async startAttempt(run: Run, options: SteamDownloadProcessOptions, version: BSVersion, { remember, passwordFails }: { remember: boolean; passwordFails?: boolean }): Promise<Attempt> {
        await run.process?.stop();
        if (run.ended) { return { done: Promise.resolve() }; }

        let process: SteamDownloadProcess;
        try {
            process = this.deps.createProcess(options, version, remember ? session => this.rememberSession(session) : undefined);
        } catch (error) {
            return { done: Promise.reject(error) };
        }
        run.process = process;

        let subscription: Subscription;
        const done = new Promise<void>((resolve, reject) => {
            subscription = process.$events().pipe(
                concatMap(async event => this.translate(run, event, version, passwordFails)),
            ).subscribe({ error: reject, complete: resolve });
        }).finally(() => subscription?.unsubscribe());

        return { process, done };
    }

    private async translate(run: Run, event: DepotDownloaderEvent, version: BSVersion, passwordFails: boolean): Promise<void> {
        if (event.type === DepotDownloaderEventType.Error) {
            throw new CustomError("bs-downloader failed", event.subType ?? DepotDownloaderErrorEvent.Unknown, event);
        }

        if (event.type === DepotDownloaderEventType.Warning) {
            this.emit(run, { type: "Warning", code: event.subType as DepotDownloaderWarningEvent });
            return;
        }

        const data = typeof event.data === "string" ? event.data : "";

        switch (event.subType) {
            case DepotDownloaderInfoEvent.Password:
                if (passwordFails) { throw new CustomError("Steam asked for a password", PASSWORD_REQUIRED); }
                return;
            case DepotDownloaderInfoEvent.QRCode:
                return this.emit(run, { type: "QrCode", url: data });
            case DepotDownloaderInfoEvent.SteamID:
                run.onPassword = undefined;
                return this.emit(run, { type: "LoggedIn", steamId: data });
            case DepotDownloaderInfoEvent.Guard:
            case DepotDownloaderInfoEvent.TwoFA:
                return this.emit(run, { type: "NeedsGuardCode" });
            case DepotDownloaderInfoEvent.MobileApp:
                return this.emit(run, { type: "NeedsMobileApproval" });
            case DepotDownloaderInfoEvent.Progress:
            case DepotDownloaderInfoEvent.Validated:
                return this.emit(run, { type: "Progress", progress: parseFloat(data.replaceAll(",", ".")) });
            case DepotDownloaderInfoEvent.Finished:
                await this.deps.commitVersion(version);
                return this.emit(run, { type: "Done", version });
            default:
                return undefined;
        }
    }
}

function toDownloadError(error: unknown): CustomError {
    if (error instanceof CustomError && Object.values(DepotDownloaderErrorEvent).includes(error.code as DepotDownloaderErrorEvent)) {
        return error;
    }
    return new CustomError((error as Error)?.message ?? "Steam download failed", DepotDownloaderErrorEvent.Unknown, error);
}
