import { DeepLinkService } from "../deep-link.service";
import log from "electron-log"
import { ipcMain } from "electron";
import { IpcRequest } from "shared/models/ipc";
import { UtilsService } from "../utils.service";
import { WindowManagerService } from "../window-manager.service";
import { MSModel, MSModelType } from "../../../shared/models/models/model-saber.model";
import { BSVersion } from "shared/bs-version.interface";
import { BSLocalVersionService } from "../bs-local-version.service";
import path from "path";
import { RequestService } from "../request.service";
import { copyFileSync } from "fs-extra";
import sanitize from "sanitize-filename";
import { Progression, ensureFolderExist, unlinkPath } from "../../helpers/fs.helpers";
import { MODEL_FILE_EXTENSIONS, MODEL_TYPES, MODEL_TYPE_FOLDERS } from "../../../shared/models/models/constants";
import { InstallationLocationService } from "../installation-location.service";
import { Observable, lastValueFrom } from "rxjs";
import { readdir } from "fs/promises";
import md5File from "md5-file";
import { allSettled } from "../../../shared/helpers/promise.helpers";
import { ModelSaberService } from "../thrid-party/model-saber/model-saber.service";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { ArchiveProgress } from "shared/models/archive.interface";
import { Archive } from "../../models/archive.class";

export class LocalModelsManagerService {

    private static instance: LocalModelsManagerService;

    public static getInstance(): LocalModelsManagerService{
        if(!LocalModelsManagerService.instance){ LocalModelsManagerService.instance = new LocalModelsManagerService(); }
        return LocalModelsManagerService.instance;
    }

    private readonly DEEP_LINKS = {
        ModelSaber: "modelsaber",
    };

    private readonly deepLink: DeepLinkService;
    private readonly utils: UtilsService;
    private readonly windows: WindowManagerService;
    private readonly localVersion: BSLocalVersionService;
    private readonly installPaths: InstallationLocationService;
    private readonly request: RequestService;
    private readonly modelSaber: ModelSaberService;

    private constructor(){
        this.deepLink = DeepLinkService.getInstance();
        this.utils = UtilsService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.localVersion = BSLocalVersionService.getInstance();
        this.request = RequestService.getInstance();
        this.installPaths = InstallationLocationService.getInstance();
        this.modelSaber = ModelSaberService.getInstance();

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

        const rootPath = !!version ? await this.localVersion.getVersionPath(version) : this.installPaths.sharedContentPath;
        const modelFolderPath = path.join(rootPath, MODEL_TYPE_FOLDERS[type]);

        await ensureFolderExist(modelFolderPath);

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

    private async getModelsPaths(type: MSModelType, version?: BSVersion): Promise<string[]>{
        const modelsPath = await this.getModelFolderPath(type, version);
        const files = await readdir(modelsPath, {withFileTypes: true});

        //return files.filter(file => file.isFile() && path.extname(file.name) === MODEL_FILE_EXTENSIONS[type]).map(file => path.join(modelsPath, file.name));
        return files.reduce((acc, file) => {
            if(!file.isFile() || path.extname(file.name) !== MODEL_FILE_EXTENSIONS[type]){ return acc; }
            acc.push(path.join(modelsPath, file.name));
            return acc;
        }, []);
    }

    public getModels(type: MSModelType, version?: BSVersion): Observable<Progression<BsmLocalModel[]>>{

        const progression: Progression<BsmLocalModel[]> = {
            total: 0,
            current: 0,
            extra: null
        };

        return new Observable<Progression<BsmLocalModel[]>>(subscriber => {
            (async () => {
                const modelsPaths = await this.getModelsPaths(type, version);
                progression.total = modelsPaths.length;

                const models = await allSettled(modelsPaths.map(async modelPath => {
                    
                    const hash = await md5File(modelPath)
                    
                    const localModel: BsmLocalModel = {
                        path: modelPath,
                        fileName: path.basename(modelPath, MODEL_FILE_EXTENSIONS[type]),
                        model: await this.modelSaber.getModelByHash(hash),
                        type, hash
                    }

                    progression.current++;

                    subscriber.next(progression);

                    return localModel;
                }));

                progression.extra = models;
                subscriber.next(progression);

            })().catch(e => subscriber.error(e)).finally(() => subscriber.complete());
        });

    }

    public async exportModels(output: string, version?: BSVersion, models?: BsmLocalModel[]): Promise<Observable<ArchiveProgress>>{
        // TOTO NOT ASYNC
        const archive = new Archive(output);
        if(models?.length){
            models.forEach(model => archive.addFile(model.path, path.join(MODEL_TYPE_FOLDERS[model.type], path.basename(model.path))));
        }
        else{
            for(const type of MODEL_TYPES){
                archive.addDirectory(await this.getModelFolderPath(type, version));
            }
        }

        return archive.finalize();
    }

    public deleteModels(models: BsmLocalModel[]): Observable<Progression>{
        return new Observable<Progression>(subscriber => {
            (async () => {
                const progression: Progression = {
                    total: models.length,
                    current: 0,
                    extra: null
                };

                for(const model of models){
                    await unlinkPath(model.path);
                    progression.current += 1;
                    subscriber.next(progression);
                }

            })().catch(e => subscriber.error(e)).finally(() => subscriber.complete());
        });
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

export interface BsmLocalModelsProgress {
    total: number;
    loaded: number;
    models: MSModel[];
}