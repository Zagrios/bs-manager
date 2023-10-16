import { DownloadInfo } from "main/services/bs-installer.service";
import { BehaviorSubject, Observable, ReplaySubject, Subscription, lastValueFrom, throwError } from "rxjs";
import { filter, map, share, take, tap, throttleTime } from "rxjs/operators";
import { BSVersion } from "shared/bs-version.interface";
import { AuthUserService } from "../auth-user.service";
import { BSVersionManagerService } from "../bs-version-manager.service";
import { IpcService } from "../ipc.service";
import { ModalExitCode, ModalService } from "../modale.service";
import { NotificationService } from "../notification.service";
import { ProgressBarService } from "../progress-bar.service";
import { LoginModal } from "renderer/components/modal/modal-types/login-modal.component";
import { GuardModal } from "renderer/components/modal/modal-types/guard-modal.component";
import { LinkOpenerService } from "../link-opener.service";
import { DepotDownloaderErrorEvent, DepotDownloaderEvent, DepotDownloaderEventType, DepotDownloaderInfoEvent, DepotDownloaderWarningEvent } from "../../../shared/models/depot-downloader.model";
import { SteamMobileApproveModal } from "renderer/components/modal/modal-types/steam-mobile-approve-modal.component";

export class SteamDownloaderService {
    private static instance: SteamDownloaderService;

    private readonly modalService: ModalService;
    private readonly ipcService: IpcService;
    private readonly bsVersionManager: BSVersionManagerService;
    private readonly authService: AuthUserService;
    private readonly progressBarService: ProgressBarService;
    private readonly notificationService: NotificationService;
    private readonly linkOpener: LinkOpenerService;

    private readonly isVerification$ = new BehaviorSubject(false);
    public readonly currentBsVersionDownload$ = new BehaviorSubject<BSVersion>(null);
    public readonly downloadProgress$ = new BehaviorSubject(0);

    public static getInstance(): SteamDownloaderService {
        if (!SteamDownloaderService.instance) {
            SteamDownloaderService.instance = new SteamDownloaderService();
        }
        return SteamDownloaderService.instance;
    }

    private constructor() {
        this.ipcService = IpcService.getInstance();
        this.modalService = ModalService.getInstance();
        this.bsVersionManager = BSVersionManagerService.getInstance();
        this.authService = AuthUserService.getInstance();
        this.progressBarService = ProgressBarService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.linkOpener = LinkOpenerService.getInstance();
    }

    public isDotNet6Installed(): Promise<boolean> {
        return lastValueFrom(this.ipcService.sendV2<boolean>("is-dotnet-6-installed"));
    }

    private async showDotNetNotInstalledError(): Promise<void> {
        const choice = await this.notificationService.notifyError({
            duration: 11_000,
            title: "notifications.bs-download.errors.titles.dotnet-required",
            desc: "notifications.bs-download.errors.msg.dotnet-required",
            actions: [{ id: "0", title: "notifications.bs-download.errors.actions.download-dotnet" }],
        });

        if (choice === "0") {
            this.linkOpener.open("https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-6.0.12-windows-x64-installer");
        }
    }

    public get isDownloading(): boolean {
        return !!this.currentBsVersionDownload$.value;
    }

    public async getInstallationFolder(): Promise<string> {
        return lastValueFrom(this.ipcService.sendV2<string>("bs-download.installation-folder"));
    }

    public get isVerification(): boolean {
        return this.isVerification$.value;
    }

    public setInstallationFolder(path: string): Observable<string> {
        return this.ipcService.sendV2<string>("bs-download.set-installation-folder", { args: path });
    }

    public async importVersion(pathToImport: string): Promise<boolean> {
        return lastValueFrom(this.ipcService.sendV2<void>("bs-download.import-version", { args: pathToImport }))
            .then(() => true)
            .catch(() => false);
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
                this.currentBsVersionDownload$.next(downloadVersion);
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
            const res = await this.modalService.openModal(SteamMobileApproveModal, { logged$ });
            if(res.exitCode !== ModalExitCode.COMPLETED){
                return this.stopDownload();
            }
        }));

        subs.push(events$.pipe(
            filter(event => event.subType === DepotDownloaderInfoEvent.TwoFA || event.subType === DepotDownloaderInfoEvent.Guard),
            take(1),
            map(event => event.subType),
        ).subscribe(async () => {
            const res = await this.modalService.openModal(GuardModal);
            if(res.exitCode !== ModalExitCode.COMPLETED){
                return this.stopDownload();
            }
            this.sendInput(res.data);
        }));

        subs.push(events$.pipe(
            filter(event => event.subType === DepotDownloaderInfoEvent.Finished),
            take(1),
        ).subscribe(() => {
            if(this.isVerification){
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
            this.notificationService.notifyWarning({title: "notifications.types.warning", desc: `notifications.bs-download.warnings.msg.${event.subType}`});
        }));

        return subs;
    }

    private hanndleErrorEvent(errorEvent: DepotDownloaderEvent) {
        const handledErrors = Object.values(DepotDownloaderErrorEvent);

        if(handledErrors.includes(errorEvent?.subType as DepotDownloaderErrorEvent)){
            return this.notificationService.notifyError({title: "notifications.types.error", desc: `notifications.bs-download.errors.msg.${errorEvent.subType}`, duration: 10_000});
        }

        return this.notificationService.notifyError({title: "notifications.types.error", desc: `notifications.bs-download.errors.msg.${DepotDownloaderErrorEvent.Unknown}`, duration: 10_000});
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
                    this.authService.deleteSteamSession();
                    !silent && this.hanndleErrorEvent(e)
                }
            }),
            share({connector: () => new ReplaySubject(1)})
        );
        
    }

    private tryAutoDownloadBsVersion(downloadInfo: DownloadInfo){

        if(!this.authService.sessionExist()){
            return throwError(() => new Error("No session"));
        }

        const infos: DownloadInfo = {...downloadInfo, username: this.authService.getSteamUsername()}
        return this.wrapDownload(
            this.ipcService.sendV2<DepotDownloaderEvent>("auto-download-bs-version", { args: infos }),
            true
        );
    }

    private startDownload(downloadInfo: DownloadInfo){
        return this.wrapDownload(
            this.ipcService.sendV2<DepotDownloaderEvent>("download-bs-version", { args: downloadInfo })
        );
    }

    private startQrCodeDownload(downloadInfo: DownloadInfo){
        return this.wrapDownload(
            this.ipcService.sendV2<DepotDownloaderEvent>("download-bs-version-qr", { args: downloadInfo })
        );
    }

    private doDownloadBsVersion(bsVersion: BSVersion, isVerification?: boolean): Promise<void>{

        if(!this.progressBarService.require()){
            return Promise.resolve();
        }

        this.progressBarService.show(this.downloadProgress$, true);
        this.isVerification$.next(isVerification);
        
        const downloadPromise = (async () => {

            const haveDotNet = await this.isDotNet6Installed().catch(() => false);
            if(!haveDotNet){
                this.showDotNetNotInstalledError();
                return Promise.reject(new Error("DotNet not installed"));
            }

            const downloadInfo: DownloadInfo = {bsVersion, isVerification}
        
            const autoDownload = await lastValueFrom(this.tryAutoDownloadBsVersion(downloadInfo)).then(() => true).catch(() => false);
            
            if(autoDownload){ return Promise.resolve(); }

            const qrCodeDownload$ = this.startQrCodeDownload(downloadInfo);
            const qrCode$ = qrCodeDownload$.pipe(filter(event => event.type === DepotDownloaderEventType.Info && event.subType === DepotDownloaderInfoEvent.QRCode), map(event => event.data as string));
            const logged$ = qrCodeDownload$.pipe(filter(event => event.type === DepotDownloaderEventType.Info && event.subType === DepotDownloaderInfoEvent.SteamID), map(event => event.data as string), take(1));

            const loginRes = await this.modalService.openModal(LoginModal, { qrCode$, logged$ });

            if(loginRes.exitCode !== ModalExitCode.COMPLETED){
                return Promise.resolve();
            }

            if(loginRes.data.stay){
                this.authService.setSteamSession(loginRes.data.username);
            }

            const download$ = loginRes.data.method === "qr" ? qrCodeDownload$ : this.startDownload({...downloadInfo, username: loginRes.data.username, password: loginRes.data.password, stay: loginRes.data.stay});

            return lastValueFrom(download$);

        })();

        // *** TEST EXPIRATION MOBILE APP APROVAL ***

        return downloadPromise.then(() => {}).finally(() => {
            this.downloadProgress$.next(0);
            this.currentBsVersionDownload$.next(null);
            this.progressBarService.hide(true);
            this.isVerification$.next(false);
            this.bsVersionManager.askInstalledVersions();
        });

    }

    private sendInput(input: string){
        return lastValueFrom(this.ipcService.sendV2<void>("send-input-bs-download", { args: input }));
    }

    public downloadBsVersion(version: BSVersion): Promise<BSVersion> {
        return this.doDownloadBsVersion(version).then(() => version);
    }

    public verifyBsVersionFiles(version: BSVersion): Promise<BSVersion> {
        return this.doDownloadBsVersion(version, true).then(() => version);
    }

    public verifyBsVersion(version: BSVersion): Promise<BSVersion> {
        return this.doDownloadBsVersion(version, true).then(() => version);
    }

    public stopDownload(): Promise<void>{
        return lastValueFrom(this.ipcService.sendV2<void>("stop-download-bs-version"));
    }
}
