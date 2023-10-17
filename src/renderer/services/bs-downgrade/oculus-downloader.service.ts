import { Observable, catchError, lastValueFrom, map, of, tap, throwError } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { IpcService } from "../ipc.service";
import { Progression } from "main/helpers/fs.helpers";
import { ProgressBarService } from "../progress-bar.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { NotificationService } from "../notification.service";
import { OculusDownloadInfo } from "main/services/bs-oculus-downloader.service";
import { ModalExitCode, ModalService } from "../modale.service";
import { LoginToMetaModal } from "renderer/components/modal/modal-types/bs-downgrade/login-to-meta-modal.component";

export class OculusDownloaderService {

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

    private constructor(){
        this.ipc = IpcService.getInstance();
        this.progressBar = ProgressBarService.getInstance();
        this.notifications = NotificationService.getInstance();
        this.modals = ModalService.getInstance();
    }

    private handleDownloadErrors(err: CustomError): void{
        if(!err?.code){
            // handle unknown error
        }

        this.notifications.notifyError({title: err.code});
    }

    private handleDownload(download: Observable<Progression>): Observable<Progression> {
        const progress$ = download.pipe(map(progress => (progress.current / progress.total) * 100), catchError(() => of(0)));
        this.progressBar.show(progress$, true);

        return download.pipe(tap({
            error: err => this.handleDownloadErrors(err),
        }));
    }

    private tryAutoDownload(version: BSVersion): Observable<Progression>{
        return this.handleDownload(
            this.ipc.sendV2("bs-oculus-auto-download", { args: version })
        );
    }

    private doDownloadBsVersion(downloadInfo: OculusDownloadInfo): Observable<Progression>{
        return this.handleDownload(
            this.ipc.sendV2("bs-oculus-download", { args: downloadInfo })
        );
    }

    public async downloadBsVersion(version: BSVersion): Promise<BSVersion> {
        return (async () => {

            const autoDownload = await lastValueFrom(this.tryAutoDownload(version)).then(() => true).catch(() => false);

            console.log("LAAAA");
            
            if(autoDownload){
                return autoDownload;
            }

            const [confirm, stay] = await this.modals.openModal(LoginToMetaModal).then(res => [res.exitCode === ModalExitCode.COMPLETED, res.data]);

            if(!confirm){
                return confirm;
            }

            return lastValueFrom(this.doDownloadBsVersion({ version, stay })).then(() => true);

        })().then(() => version)
            .finally(() => this.progressBar.hide(true));
    }

}