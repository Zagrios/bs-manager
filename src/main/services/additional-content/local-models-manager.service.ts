import { DeepLinkService } from "../deep-link.service";
import log from "electron-log"
import { ipcMain } from "electron";
import { IpcRequest } from "shared/models/ipc";
import { UtilsService } from "../utils.service";
import { WindowManagerService } from "../window-manager.service";
import { MSModel, MSModelType } from "shared/models/model-saber/model-saber.model";
import { BSVersion } from "shared/bs-version.interface";
import { BSLocalVersionService } from "../bs-local-version.service";
import path from "path";
import { RequestService } from "../request.service";
import { copyFileSync } from "fs-extra";
import sanitize from "sanitize-filename";

export class LocalModelsManagerService {

    private static instance: LocalModelsManagerService;

    public static getInstance(): LocalModelsManagerService{
        if(!LocalModelsManagerService.instance){ LocalModelsManagerService.instance = new LocalModelsManagerService(); }
        return LocalModelsManagerService.instance;
    }

    private readonly DEEP_LINKS = {
        ModelSaber: "modelsaber",
    };

    private readonly MODEL_TYPE_FOLDER: Record<Exclude<MSModelType, "misc">, string>  = {
        avatar: "CustomAvatars",
        bloq: "CustomNotes",
        platform: "CustomPlatforms",
        saber: "CustomSabers"
    }

    private readonly deepLink: DeepLinkService;
    private readonly utils: UtilsService;
    private readonly windows: WindowManagerService;
    private readonly localVersion: BSLocalVersionService;
    private readonly request: RequestService;

    private constructor(){
        this.deepLink = DeepLinkService.getInstance();
        this.utils = UtilsService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.localVersion = BSLocalVersionService.getInstance();
        this.request = RequestService.getInstance();

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.ModelSaber, (link) => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.ModelSaber, link);
            const url = new URL(link);

            const type = url.host
            const id = url.pathname.replace("/", '').split("/").at(0);

            this.openOneClickDownloadModelWindow(id, type);
        });
    }

    private openOneClickDownloadModelWindow(id: string, type: string){
        
        ipcMain.once("one-click-model-info", async (event, req: IpcRequest<void>) => {
            this.utils.ipcSend(req.responceChannel, {success: true, data: {id, type}});
        });

        this.windows.openWindow("oneclick-download-model.html");

    }

    private async getModelFolderPath(type: MSModelType, version?: BSVersion): Promise<string>{

        if(!version){ throw "will be implemented whith models management" }
        if(type === "misc"){ throw "model type not supported"; }

        const versionPath = await this.localVersion.getVersionPath(version);
        const modelFolderPath = path.join(versionPath, this.MODEL_TYPE_FOLDER[type]);

        this.utils.createFolderIfNotExist(modelFolderPath);

        return modelFolderPath;

    }

    public async downloadModel(model: MSModel, version: BSVersion): Promise<string>{
        
        const modelFolder = await this.getModelFolderPath(model.type, version);
        const modelDest = path.join(modelFolder, sanitize(path.basename(model.download)));

        return this.request.downloadFile(model.download, modelDest);

    }

    public async oneClickDownloadModel(model: MSModel): Promise<void>{

        if(!model){ return; }

        const versions = await this.localVersion.getInstalledVersions();

        if(versions?.length === 0){ return; }

        const fisrtVersion = versions.shift();

        const downloaded = await this.downloadModel(model, fisrtVersion);

        for(const version of versions){

            const modelDest = path.join(await this.getModelFolderPath(model.type, version), path.basename(downloaded));

            copyFileSync(downloaded, modelDest);

        }

    }

    public enableDeepLinks(): boolean{
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.registerDeepLink(link));
    }

    public disableDeepLinks(): boolean{
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.unRegisterDeepLink(link));
    }

    public isDeepLinksEnabled(): boolean{
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.isDeepLinkRegistred(link));
    }

}