import { BehaviorSubject, ReplaySubject, Subject, lastValueFrom, noop } from "rxjs";
import { take, throttleTime } from "rxjs/operators";
import { BSVersion } from "shared/bs-version.interface";
import { IpcService } from "../ipc.service";
import { ModalExitCode, ModalService } from "../modale.service";
import { NotificationService } from "../notification.service";
import { ProgressBarService } from "../progress-bar.service";
import { LoginToSteamModal } from "renderer/components/modal/modal-types/bs-downgrade/login-to-steam-modal.component";
import { SteamGuardModal } from "renderer/components/modal/modal-types/bs-downgrade/steam-guard-modal.component";
import { DepotDownloaderErrorEvent, DepotDownloaderWarningEvent } from "../../../shared/models/bs-version-download/depot-downloader.model";
import { SteamDownloadAnswer, SteamDownloadEvent } from "shared/models/bs-version-download/steam-download.model";
import { SteamMobileApproveModal } from "renderer/components/modal/modal-types/bs-downgrade/steam-mobile-approve-modal.component";
import { DownloaderServiceInterface, StoreDownloadOptions } from "./bs-store-downloader.interface";
import { addFilterStringLog, logRenderError } from "renderer";
import { CustomError } from "shared/models/exceptions/custom-error.class";

export class SteamDownloaderService implements DownloaderServiceInterface {

    private static instance: SteamDownloaderService;

    public static getInstance(): SteamDownloaderService {
        if (!SteamDownloaderService.instance) {
            SteamDownloaderService.instance = new SteamDownloaderService();
        }
        return SteamDownloaderService.instance;
    }

    private readonly modalService: ModalService;
    private readonly ipcService: IpcService;
    private readonly progressBarService: ProgressBarService;
    private readonly notificationService: NotificationService;

    private readonly LEGACY_STEAM_USERNAME_KEY = "STEAM-USERNAME";
    private readonly legacySessionImported: Promise<void>;

    private constructor() {
        this.ipcService = IpcService.getInstance();
        this.modalService = ModalService.getInstance();
        this.progressBarService = ProgressBarService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.legacySessionImported = this.importLegacySession();
    }

    private async importLegacySession(): Promise<void> {
        try {
            const username = localStorage.getItem(this.LEGACY_STEAM_USERNAME_KEY);
            if (!username) { return; }
            await lastValueFrom(this.ipcService.sendV2("import-legacy-steam-username", username));
            localStorage.removeItem(this.LEGACY_STEAM_USERNAME_KEY);
        } catch (e) {
            logRenderError("Unable to import the legacy Steam session", e);
        }
    }

    public async getSteamUsername(): Promise<string | undefined> {
        await this.legacySessionImported;
        return lastValueFrom(this.ipcService.sendV2("steam-session-username"));
    }

    public async sessionExists(): Promise<boolean> {
        await this.legacySessionImported;
        return lastValueFrom(this.ipcService.sendV2("steam-session-exists"));
    }

    public async deleteSteamSession(): Promise<void> {
        await this.legacySessionImported;
        return lastValueFrom(this.ipcService.sendV2("delete-steam-session"));
    }

    // ### Downloading

    private notifyError(error: CustomError) {
        const handledErrors = Object.values(DepotDownloaderErrorEvent);
        const code = handledErrors.includes(error?.code as DepotDownloaderErrorEvent) ? error.code : DepotDownloaderErrorEvent.Unknown;
        return this.notificationService.notifyError({title: "notifications.types.error", desc: `notifications.bs-download.steam-download.errors.msg.${code}`, duration: 10_000});
    }

    private respond(downloadId: string, answer: SteamDownloadAnswer): Promise<boolean> {
        return lastValueFrom(this.ipcService.sendV2("bs-steam-download-respond", { downloadId, answer })).catch(() => false);
    }

    private runDownload(bsVersion: BSVersion, { isVerification, onStart }: StoreDownloadOptions, progress$: Subject<number>): Promise<BSVersion | undefined> {
        return new Promise<BSVersion | undefined>((resolve, reject) => {
            const qrCode$ = new ReplaySubject<string>(1);
            const loggedIn$ = new ReplaySubject<string>(1);
            const warnings$ = new Subject<DepotDownloaderWarningEvent>();
            let downloadId: string;
            let downloaded: BSVersion;
            let ended = false;
            let guardPromptOpened = false;
            let mobilePromptOpened = false;

            const warningsSub = warnings$.pipe(throttleTime(10_000)).subscribe(code => {
                this.notificationService.notifyWarning({title: "notifications.types.warning", desc: `notifications.bs-download.steam-download.warnings.msg.${code}`});
            });

            const stopIfRunning = () => !ended && this.stopDownload();

            const askLogin = async () => {
                const res = await this.modalService.openModal(LoginToSteamModal, { data: { qrCode$, logged$: loggedIn$.pipe(take(1)) } });
                if (ended) { return; }
                if (res.exitCode !== ModalExitCode.COMPLETED) { return stopIfRunning(); }
                if (res.data.method !== "form") { return; }

                if (res.data.password) { addFilterStringLog(res.data.password); }
                this.respond(downloadId, { type: "Password", username: res.data.username, password: res.data.password, stay: res.data.stay });
            };

            const askGuardCode = async () => {
                if (guardPromptOpened) { return; }
                guardPromptOpened = true;
                const res = await this.modalService.openModal(SteamGuardModal, { data: { logged$: loggedIn$.pipe(take(1)) } });
                guardPromptOpened = false;
                if (res.exitCode !== ModalExitCode.COMPLETED) { return stopIfRunning(); }
                if (res.data && !ended) { this.respond(downloadId, { type: "GuardCode", code: res.data }); }
            };

            const askMobileApproval = async () => {
                if (mobilePromptOpened) { return; }
                mobilePromptOpened = true;
                const res = await this.modalService.openModal(SteamMobileApproveModal, { data: { logged$: loggedIn$.pipe(take(1)) } });
                mobilePromptOpened = false;
                if (res.exitCode !== ModalExitCode.COMPLETED) { return stopIfRunning(); }
            };

            const onEvent = (event: SteamDownloadEvent) => {
                switch (event.type) {
                    case "Started":
                        downloadId = event.downloadId;
                        onStart(event.version);
                        break;
                    case "NeedsLogin":
                        askLogin();
                        break;
                    case "QrCode":
                        qrCode$.next(event.url);
                        break;
                    case "LoggedIn":
                        loggedIn$.next(event.steamId || "logged");
                        break;
                    case "NeedsGuardCode":
                        askGuardCode();
                        break;
                    case "NeedsMobileApproval":
                        askMobileApproval();
                        break;
                    case "Progress":
                        progress$.next(event.progress);
                        break;
                    case "Warning":
                        warnings$.next(event.code);
                        break;
                    case "Done":
                        downloaded = event.version;
                        this.notificationService.notifySuccess({ title: isVerification ? "notifications.bs-download.success.titles.verification-finished" : "notifications.bs-download.success.titles.download-success" });
                        break;
                    default:
                        break;
                }
            };

            const end = () => {
                ended = true;
                warningsSub.unsubscribe();
                qrCode$.complete();
                loggedIn$.complete();
            };

            this.ipcService.sendV2("bs-steam-download", { bsVersion, isVerification }).subscribe({
                next: onEvent,
                error: (error: CustomError) => {
                    end();
                    this.notifyError(error);
                    reject(error);
                },
                complete: () => {
                    end();
                    resolve(downloaded);
                },
            });
        });
    }

    public async download(version: BSVersion, options: StoreDownloadOptions): Promise<BSVersion | undefined> {
        if(!this.progressBarService.require()){
            return undefined;
        }

        const progress$ = new BehaviorSubject(0);
        this.progressBarService.show(progress$);

        try {
            await this.legacySessionImported;
            return await this.runDownload(version, options, progress$);
        } finally {
            progress$.complete();
            this.progressBarService.hide();
        }
    }

    public stopDownload(): Promise<void>{
        return lastValueFrom(this.ipcService.sendV2("bs-steam-stop-download")).then(noop);
    }
}
