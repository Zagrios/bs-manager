import { DeepLinkService } from "../deep-link.service";
import log from "electron-log";
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
import { Observable, Subscription, lastValueFrom } from "rxjs";
import { readdir } from "fs/promises";
import md5File from "md5-file";
import { allSettled } from "../../../shared/helpers/promise.helpers";
import { ModelSaberService } from "../thrid-party/model-saber/model-saber.service";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { Archive } from "../../models/archive.class";

export class LocalModelsManagerService {
    private static instance: LocalModelsManagerService;

    public static getInstance(): LocalModelsManagerService {
        if (!LocalModelsManagerService.instance) {
            LocalModelsManagerService.instance = new LocalModelsManagerService();
        }
        return LocalModelsManagerService.instance;
    }

    private readonly DEEP_LINKS = {
        ModelSaber: "modelsaber",
    };

    private readonly deepLink: DeepLinkService;
    private readonly windows: WindowManagerService;
    private readonly localVersion: BSLocalVersionService;
    private readonly installPaths: InstallationLocationService;
    private readonly request: RequestService;
    private readonly modelSaber: ModelSaberService;

    private constructor() {
        this.deepLink = DeepLinkService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.localVersion = BSLocalVersionService.getInstance();
        this.request = RequestService.getInstance();
        this.installPaths = InstallationLocationService.getInstance();
        this.modelSaber = ModelSaberService.getInstance();

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.ModelSaber, link => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.ModelSaber, link);

            const url = new URL(link);
            const id = url.pathname.replace("/", "").split("/").at(0);

            this.windows.openWindow(`oneclick-download-model.html?modelId=${id}`);
        });
    }

    private async getModelFolderPath(type: MSModelType, version?: BSVersion): Promise<string> {
        const rootPath = await (version ? this.localVersion.getVersionPath(version) : this.installPaths.sharedContentPath());
        const modelFolderPath = path.join(rootPath, MODEL_TYPE_FOLDERS[type]);

        await ensureFolderExist(modelFolderPath);

        return modelFolderPath;
    }

    public downloadModel(model: MSModel, version: BSVersion): Observable<Progression<BsmLocalModel>> {
        return new Observable<Progression<BsmLocalModel>>(subscriber => {
            const subs: Subscription[] = [];

            (async () => {
                const modelFolder = await this.getModelFolderPath(model.type, version);
                const modelDest = path.join(modelFolder, sanitize(path.basename(model.download)));

                const url = model.download.split("/");
                url[url.length - 1] = encodeURIComponent(url[url.length - 1]);

                const download$ = this.request.downloadFile(url.join("/"), modelDest);

                subs.push(download$.subscribe({ next: value => subscriber.next({ ...value, data: undefined }), error: e => subscriber.error(e) }));

                const downloaded = await lastValueFrom(download$);

                const res: BsmLocalModel = {
                    path: downloaded.data,
                    fileName: path.basename(downloaded.data),
                    hash: await md5File(downloaded.data),
                    type: model.type,
                    model,
                    version,
                };

                subscriber.next({ ...downloaded, data: res });
            })()
                .catch(err => subscriber.error(err))
                .then(() => subscriber.complete());

            return () => {
                subs.forEach(sub => sub.unsubscribe());
            };
        });
    }

    public async oneClickDownloadModel(model: MSModel): Promise<void> {
        if (!model) { return; }

        const versions = await this.localVersion.getInstalledVersions();
        const downloaded = await lastValueFrom(this.downloadModel(model, versions.pop()));

        for (const version of versions) {
            const modelDest = path.join(await this.getModelFolderPath(model.type, version), path.basename(downloaded.data.path));
            copyFileSync(downloaded.data.path, modelDest);
        }
    }

    private async getModelsPaths(type: MSModelType, version?: BSVersion): Promise<string[]> {
        const modelsPath = await this.getModelFolderPath(type, version);
        const files = await readdir(modelsPath, { withFileTypes: true });

        return files.reduce((acc, file) => {
            if (!file.isFile() || path.extname(file.name) !== MODEL_FILE_EXTENSIONS[type]) {
                return acc;
            }
            acc.push(path.join(modelsPath, file.name));
            return acc;
        }, []);
    }

    public getModels(type: MSModelType, version?: BSVersion): Observable<Progression<BsmLocalModel[]>> {
        const progression: Progression<BsmLocalModel[]> = {
            total: 0,
            current: 0,
            data: null,
        };

        return new Observable<Progression<BsmLocalModel[]>>(subscriber => {
            (async () => {
                const modelsPaths = await this.getModelsPaths(type, version);
                progression.total = modelsPaths.length;

                const models = await allSettled(
                    modelsPaths.map(async modelPath => {
                        const hash = await md5File(modelPath);

                        const localModel: BsmLocalModel = {
                            path: modelPath,
                            fileName: path.basename(modelPath, MODEL_FILE_EXTENSIONS[type]),
                            model: await this.modelSaber.getModelByHash(hash),
                            type,
                            hash,
                            version,
                        };

                        progression.current++;

                        subscriber.next(progression);

                        return localModel;
                    })
                );

                progression.data = models;
                subscriber.next(progression);
            })()
                .catch(e => subscriber.error(e))
                .finally(() => subscriber.complete());
        });
    }

    public exportModels(output: string, version?: BSVersion, models?: BsmLocalModel[]): Observable<Progression> {
        return new Observable<Progression>(subscriber => {
            const archive = new Archive(output);

            (async () => {
                if (models?.length) {
                    models.forEach(model => archive.addFile(model.path, path.join(MODEL_TYPE_FOLDERS[model.type], path.basename(model.path))));
                } else {
                    for (const type of MODEL_TYPES) {
                        archive.addDirectory(await this.getModelFolderPath(type, version));
                    }
                }
            })()
                .catch(e => subscriber.error(e))
                .then(() => archive.finalize().subscribe(subscriber));
        });
    }

    public deleteModels(models: BsmLocalModel[]): Observable<Progression<BsmLocalModel[]>> {
        return new Observable<Progression<BsmLocalModel[]>>(subscriber => {
            (async () => {
                const progression: Progression<BsmLocalModel[]> = {
                    total: models.length,
                    current: 0,
                    data: [],
                };

                for (const model of models) {
                    await unlinkPath(model.path);
                    progression.data.push(model);
                    progression.current = progression.data.length;
                    subscriber.next(progression);
                }
            })()
                .catch(e => subscriber.error(e))
                .finally(() => subscriber.complete());
        });
    }

    public enableDeepLinks(): boolean {
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.registerDeepLink(link));
    }

    public disableDeepLinks(): boolean {
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.unRegisterDeepLink(link));
    }

    public isDeepLinksEnabled(): boolean {
        return Array.from(Object.values(this.DEEP_LINKS)).every(link => this.deepLink.isDeepLinkRegistered(link));
    }
}

export interface BsmLocalModelsProgress {
    total: number;
    loaded: number;
    models: MSModel[];
}
