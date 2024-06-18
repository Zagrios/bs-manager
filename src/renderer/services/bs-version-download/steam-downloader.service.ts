import { DownloadSteamInfo } from "main/services/bs-version-download/bs-steam-downloader.service";
import { BehaviorSubject, Observable, ReplaySubject, Subscription, lastValueFrom, throwError } from "rxjs";
import { filter, map, share, take, tap, throttleTime } from "rxjs/operators";
import { BSVersion } from "shared/bs-version.interface";
import { IpcService } from "../ipc.service";
import { ModalExitCode, ModalService } from "../modale.service";
import { NotificationService } from "../notification.service";
import { ProgressBarService } from "../progress-bar.service";
import { LoginToSteamModal } from "renderer/components/modal/modal-types/bs-downgrade/login-to-steam-modal.component";
import { SteamGuardModal } from "renderer/components/modal/modal-types/bs-downgrade/steam-guard-modal.component";
import { LinkOpenerService } from "../link-opener.service";
import { DepotDownloaderErrorEvent, DepotDownloaderEvent, DepotDownloaderEventType, DepotDownloaderInfoEvent, DepotDownloaderWarningEvent } from "../../../shared/models/bs-version-download/depot-downloader.model";
import { SteamMobileApproveModal } from "renderer/components/modal/modal-types/bs-downgrade/steam-mobile-approve-modal.component";
import { DownloaderServiceInterface } from "./bs-store-downloader.interface";
import { AbstractBsDownloaderService } from "./abstract-bs-downloader.service";

export class SteamDownloaderService extends AbstractBsDownloaderService implements DownloaderServiceInterface{

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
    private readonly linkOpener: LinkOpenerService;

    private readonly STEAM_SESSION_USERNAME_KEY = "STEAM-USERNAME";

    public readonly downloadProgress$ = new BehaviorSubject(0);

    private constructor() {
        super();
        this.ipcService = IpcService.getInstance();
        this.modalService = ModalService.getInstance();
        this.progressBarService = ProgressBarService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.linkOpener = LinkOpenerService.getInstance();
    }

    private setSteamSession(username: string): void { localStorage.setItem(this.STEAM_SESSION_USERNAME_KEY, username); }
    public getSteamUsername(): string { return localStorage.getItem(this.STEAM_SESSION_USERNAME_KEY); }
    public deleteSteamSession(): void { localStorage.removeItem(this.STEAM_SESSION_USERNAME_KEY); }
    public sessionExist(): boolean { return !!localStorage.getItem(this.STEAM_SESSION_USERNAME_KEY); }

    public async getInstallationFolder(): Promise<string> {
        return lastValueFrom(this.ipcService.sendV2("bs-download.installation-folder"));
    }

    public setInstallationFolder(path: string): Observable<string> {
        return this.ipcService.sendV2("bs-download.set-installation-folder",  path);
    }

    // ### Downloading

    private handleInfoEvents(events$: Observable<DepotDownloaderEvent>): Subscription[] {
        const subs: Subscription[] = [];

        subs.push(events$.pipe(
            filter(event => event.subType === DepotDownloaderInfoEvent.Start),
            take(1),
            map(event => event.data as string),
        ).subscribe(startData => {
            const downloadVersion = JSON.parse(startData) as BSVersion;
            if(typeof downloadVersion === "object" && downloadVersion?.BSVersion){
                this._downloadingVersion$.next(downloadVersion);
            }
        }));

        subs.push(events$.pipe(
            filter(event => event.subType === DepotDownloaderInfoEvent.Progress || event.subType === DepotDownloaderInfoEvent.Validated),
            map(event => event.data as string),
        ).subscribe(progress => {
            this.downloadProgress$.next(parseFloat(progress.replaceAll(",", ".")));
        }));

        subs.push(events$.pipe(
            filter(event => event.subType === DepotDownloaderInfoEvent.MobileApp),
            take(1),
        ).subscribe(async () => {
            const logged$ = events$.pipe(filter(event => event.subType === DepotDownloaderInfoEvent.SteamID), take(1));
            const res = await this.modalService.openModal(SteamMobileApproveModal, {data: { logged$ }});
            if(res.exitCode !== ModalExitCode.COMPLETED){
                return this.stopDownload();
            }
        }));

        subs.push(events$.pipe(
            filter(event => event.subType === DepotDownloaderInfoEvent.TwoFA || event.subType === DepotDownloaderInfoEvent.Guard),
            take(1),
            map(event => event.subType),
        ).subscribe(async () => {
            const res = await this.modalService.openModal(SteamGuardModal);
            if(res.exitCode !== ModalExitCode.COMPLETED){
                return this.stopDownload();
            }
            this.sendInput(res.data);
        }));

        subs.push(events$.pipe(
            filter(event => event.subType === DepotDownloaderInfoEvent.Finished),
            take(1),
        ).subscribe(() => {
            if(this.isVerifying){
                return this.notificationService.notifySuccess({title: "notifications.bs-download.success.titles.verification-finished"});
            }
            return this.notificationService.notifySuccess({title: "notifications.bs-download.success.titles.download-success"});
        }));

        return subs;
    }

    private handleWarningEvents(events$: Observable<DepotDownloaderEvent>): Subscription[] {
        const subs: Subscription[] = [];

        const handledWarnings = Object.values(DepotDownloaderWarningEvent);

        subs.push(events$.pipe(
            filter(event => handledWarnings.includes(event.subType as DepotDownloaderWarningEvent)),
        ).subscribe(event => {
            this.notificationService.notifyWarning({title: "notifications.types.warning", desc: `notifications.bs-download.steam-download.warnings.msg.${event.subType}`});
        }));

        return subs;
    }

    private hanndleErrorEvent(errorEvent: DepotDownloaderEvent) {
        const handledErrors = Object.values(DepotDownloaderErrorEvent);

        if(handledErrors.includes(errorEvent?.subType as DepotDownloaderErrorEvent)){
            return this.notificationService.notifyError({title: "notifications.types.error", desc: `notifications.bs-download.steam-download.errors.msg.${errorEvent.subType}`, duration: 10_000});
        }

        return this.notificationService.notifyError({title: "notifications.types.error", desc: `notifications.bs-download.steam-download.errors.msg.${DepotDownloaderErrorEvent.Unknown}`, duration: 10_000});
    }

    private wrapDownload(download$: Observable<DepotDownloaderEvent>, silent?: boolean): Observable<DepotDownloaderEvent> {

        return new Observable<DepotDownloaderEvent>(sub => {

            const downloadSub = download$.subscribe({next: n => sub.next(n), error: e => sub.error(e), complete: () => sub.complete()});

            const subs = [
                ...this.handleInfoEvents(download$.pipe(filter(event => event.type === DepotDownloaderEventType.Info))),
                ...this.handleWarningEvents(download$.pipe(filter(event => event.type === DepotDownloaderEventType.Warning), throttleTime(10_000))),
            ];

            return () => {
                downloadSub.unsubscribe();
                subs.forEach(sub => sub.unsubscribe());
            }

        }).pipe(
            tap({
                error: (e) => {
                    this.deleteSteamSession();
                    if(!silent){ this.hanndleErrorEvent(e) }
                }
            }),
            share({connector: () => new ReplaySubject(1)})
        );

    }

    private tryAutoDownloadBsVersion(downloadInfo: DownloadSteamInfo){

        if(!this.sessionExist()){
            return throwError(() => new Error("No session"));
        }

        const infos: DownloadSteamInfo = {...downloadInfo, username: this.getSteamUsername()}
        return this.wrapDownload(
            this.ipcService.sendV2("auto-download-bs-version", infos),
            true
        );
    }

    private startDownload(downloadInfo: DownloadSteamInfo){
        return this.wrapDownload(
            this.ipcService.sendV2("download-bs-version", downloadInfo )
        );
    }

    private startQrCodeDownload(downloadInfo: DownloadSteamInfo){
        return this.wrapDownload(
            this.ipcService.sendV2("download-bs-version-qr", downloadInfo)
        );
    }

    private doDownloadBsVersion(bsVersion: BSVersion, isVerification?: boolean): Promise<void>{

        if(!this.progressBarService.require()){
            return Promise.resolve();
        }

        this.progressBarService.show(this.downloadProgress$, true);

        const downloadPromise = (async () => {

            const downloadInfo: DownloadSteamInfo = {bsVersion, isVerification}

            const autoDownload = await lastValueFrom(this.tryAutoDownloadBsVersion(downloadInfo)).then(() => true).catch(() => false);

            if(autoDownload){ return Promise.resolve(); }

            const qrCodeDownload$ = this.startQrCodeDownload(downloadInfo);
            const qrCode$ = qrCodeDownload$.pipe(filter(event => event.type === DepotDownloaderEventType.Info && event.subType === DepotDownloaderInfoEvent.QRCode), map(event => event.data as string));
            const logged$ = qrCodeDownload$.pipe(filter(event => event.type === DepotDownloaderEventType.Info && event.subType === DepotDownloaderInfoEvent.SteamID), map(event => event.data as string), take(1));

            const loginRes = await this.modalService.openModal(LoginToSteamModal, {data: { qrCode$, logged$ }});

            if(loginRes.exitCode !== ModalExitCode.COMPLETED){
                return Promise.resolve();
            }

            if(loginRes.data.stay){
                this.setSteamSession(loginRes.data.username);
            }

            const download$ = loginRes.data.method === "qr" ? qrCodeDownload$ : this.startDownload({...downloadInfo, username: loginRes.data.username, password: loginRes.data.password, stay: loginRes.data.stay});

            return lastValueFrom(download$);

        })();

        return downloadPromise.then(() => {}).finally(() => {
            this.downloadProgress$.next(0);
            this.progressBarService.hide(true);
        });

    }

    private sendInput(input: string){
        return lastValueFrom(this.ipcService.sendV2("send-input-bs-download", input));
    }

    public downloadBsVersion(version: BSVersion): Promise<BSVersion> {
        return this.doDownloadBsVersion(version).then(() => version);
    }

    public verifyBsVersion(version: BSVersion): Promise<BSVersion> {
        return this.doDownloadBsVersion(version, true).then(() => version);
    }

    public stopDownload(): Promise<void>{
        return lastValueFrom(this.ipcService.sendV2("stop-download-bs-version"));
    }
}
