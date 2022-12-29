import { timer } from "rxjs";
import { MSModel } from "shared/models/model-saber/model-saber.model";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";

export class ModelDownloaderService {

    private static instance: ModelDownloaderService;

    public static getInstance(): ModelDownloaderService{
        if(!ModelDownloaderService.instance){ ModelDownloaderService.instance = new ModelDownloaderService(); }
        return ModelDownloaderService.instance;
    }

    private readonly ipc: IpcService;
    private readonly progress: ProgressBarService;

    private constructor(){
        this.ipc = IpcService.getInstance();
        this.progress = ProgressBarService.getInstance();
    }


    public async oneClickInstallModel(model: MSModel): Promise<boolean>{

        this.progress.showFake(0.04);

        const res = await this.ipc.send("one-click-install-model", {args: model});

        this.progress.complete();
        await timer(500).toPromise();
        this.progress.hide(true);

        return res.success;

    }


}