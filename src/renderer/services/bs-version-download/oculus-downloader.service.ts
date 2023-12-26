import { Observable, Subscription, catchError, finalize, lastValueFrom, map, noop, of, take, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { IpcService } from "../ipc.service";
import { Progression } from "main/helpers/fs.helpers";
import { ProgressBarService } from "../progress-bar.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { NotificationService } from "../notification.service";
import { ModalExitCode, ModalService } from "../modale.service";
import { LoginToMetaModal, MetaAuthMethod } from "renderer/components/modal/modal-types/bs-downgrade/login-to-meta-modal.component";
import { DownloaderServiceInterface } from "./bs-store-downloader.interface";
import { AbstractBsDownloaderService } from "./abstract-bs-downloader.service";
import { DownloadInfo } from "main/services/bs-version-download/bs-steam-downloader.service";
import { MetaAuthErrorCodes, OculusDownloaderErrorCodes } from "shared/models/bs-version-download/oculus-download.model";
import { EnterMetaTokenModal } from "renderer/components/modal/modal-types/bs-downgrade/enter-meta-token-modal.component";

export class OculusDownloaderService extends AbstractBsDownloaderService implements DownloaderServiceInterface{

    private static instance: OculusDownloaderService;

    public static getInstance(): OculusDownloaderService {
        if (!OculusDownloaderService.instance) {
            OculusDownloaderService.instance = new OculusDownloaderService();
        }

        return OculusDownloaderService.instance;
    }

    private readonly ipc: IpcService;
    private readonly progressBar: ProgressBarService;
    private readonly notifications: NotificationService;
    private readonly modals: ModalService;

    private readonly DISPLAYABLE_ERROR_CODES: string[] = [...Object.values(MetaAuthErrorCodes), ...Object.values(OculusDownloaderErrorCodes)];

    private constructor(){
        super();
        this.ipc = IpcService.getInstance();
        this.progressBar = ProgressBarService.getInstance();
        this.notifications = NotificationService.getInstance();
        this.modals = ModalService.getInstance();
    }

    private handleDownloadErrors(err: CustomError): Promise<void>{
        if(!err?.code || !this.DISPLAYABLE_ERROR_CODES.includes(err.code)){
            return this.notifications.notifyError({title: "notifications.types.error", desc: `notifications.bs-download.oculus-download.errors.msg.UNKNOWN_ERROR`}).then(noop);
        }

        return this.notifications.notifyError({title: "notifications.types.error", desc: `notifications.bs-download.oculus-download.errors.msg.${err.code}`}).then(noop);
    }

    private handleDownload(download: Observable<Progression<BSVersion>>, ingoreErrorCodes?: string[]): Observable<Progression<BSVersion>> {
        const progress$ = download.pipe(map(progress => (progress.current / progress.total) * 100), catchError(() => of(0)));
        this.progressBar.show(progress$, true);

        const subs: Subscription[] = [];

        subs.push(
            download.pipe(take(1)).subscribe({ next: data => data && this._downloadingVersion$.next(data.data), error: () => {} })
        )

        return download.pipe(
            tap({
                error: (err: CustomError) => {
                    if(ingoreErrorCodes?.includes(err.code)){ return; }
                    this.handleDownloadErrors(err);
                },
            }),
            finalize(() => subs.forEach(sub => sub.unsubscribe()))
        );
    }

    private tryAutoDownload(downloadInfo: DownloadInfo): Observable<Progression<BSVersion>>{
        const ignoreCode = [MetaAuthErrorCodes.NO_META_AUTH_TOKEN, OculusDownloaderErrorCodes.DOWNLOAD_CANCELLED];
        return this.handleDownload(
            this.ipc.sendV2<Progression<BSVersion>>("bs-oculus-auto-download", { args: downloadInfo }),
            ignoreCode
        );
    }

    private startDownloadBsVersion(downloadInfo: DownloadInfo): Observable<Progression<BSVersion>>{
        const ignoreCode = [MetaAuthErrorCodes.META_LOGIN_WINDOW_CLOSED_BY_USER, OculusDownloaderErrorCodes.DOWNLOAD_CANCELLED];
        return this.handleDownload(
            this.ipc.sendV2<Progression<BSVersion>>("bs-oculus-download", { args: downloadInfo }),
            ignoreCode
        );
    }

    private async doDownloadBsVersion(bsVersion: BSVersion, isVerification: boolean): Promise<BSVersion> {

        const autoDownloadFailed = false;

        return (async () => {

            // DISABLE FOR NOW, WILL MAYBE BE RE-ENABLED WHEN META AUTH IS FIXED

            // const autoDownload = await lastValueFrom(this.tryAutoDownload({ bsVersion, isVerification })).then(() => true).catch((err: CustomError) => {
            //     const doNotRestartCodes: string[] = [
            //         OculusDownloaderErrorCodes.ALREADY_DOWNLOADING,
            //         OculusDownloaderErrorCodes.SOME_FILES_FAILED_TO_DOWNLOAD,
            //         OculusDownloaderErrorCodes.VERIFY_INTEGRITY_FAILED,
            //         OculusDownloaderErrorCodes.DOWNLOAD_CANCELLED
            //     ];
            //     autoDownloadFailed = true;

            //     if(doNotRestartCodes.includes(err?.code)){
            //         return true;
            //     }

            //     return false;
            // });
            
            // if(autoDownload){ return autoDownload; }

            // const {exitCode, data} = await this.modals.openModal(LoginToMetaModal)

            // if(exitCode !== ModalExitCode.COMPLETED){
            //     return false
            // }

            // if(data.method === MetaAuthMethod.META){
            //     return lastValueFrom(this.startDownloadBsVersion({ bsVersion, isVerification, stay: data.stay })).then(() => true);
            // }

            const tokenRes = await this.modals.openModal(EnterMetaTokenModal);

            if(tokenRes.exitCode !== ModalExitCode.COMPLETED){
                return false;
            }

            return lastValueFrom(this.startDownloadBsVersion({ bsVersion, isVerification, token: tokenRes.data })).then(() => true);

        })().then(res => {

            if(autoDownloadFailed || !res){
                return bsVersion;
            }

            if(isVerification){
                this.notifications.notifySuccess({title: "notifications.bs-download.success.titles.verification-finished"});
            } else {
                this.notifications.notifySuccess({title: "notifications.bs-download.success.titles.download-success"});
            }

            return bsVersion;
        }).finally(() => this.progressBar.hide(true));
    }

    public downloadBsVersion(version: BSVersion): Promise<BSVersion> {
        return this.doDownloadBsVersion(version, false);
    }

    public async verifyBsVersion(version: BSVersion): Promise<BSVersion> {
        return this.doDownloadBsVersion(version, true);
    }

    public stopDownload(): Promise<void>{
        return lastValueFrom(this.ipc.sendV2<void>("bs-oculus-stop-download"));
    }

    public hasAuthToken(): Promise<boolean>{
        return lastValueFrom(this.ipc.sendV2<boolean>("bs-oculus-has-auth-token"));
    }

    public clearAuthToken(): Promise<void>{
        return lastValueFrom(this.ipc.sendV2<void>("bs-oculus-clear-auth-token"));
    }

}