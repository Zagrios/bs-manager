import { Observable } from "rxjs";
import { MSGetQuery, MSGetQueryFilterType, MSModel, MSModelPlatform } from "../../../../shared/models/models/model-saber.model";
import { ModelSaberApiService } from "./model-saber-api.service";
import log from "electron-log";
import striptags from "striptags";

export class ModelSaberService {
    private static instance: ModelSaberService;

    public static getInstance(): ModelSaberService {
        if (!ModelSaberService.instance) {
            ModelSaberService.instance = new ModelSaberService();
        }
        return ModelSaberService.instance;
    }

    private readonly modelsHashCache: Map<string, MSModel> = new Map(); // key: hash, value: model

    private readonly modelSaberApi: ModelSaberApiService;

    private constructor() {
        this.modelSaberApi = ModelSaberApiService.getInstance();
    }

    public async getModelById(id: number | string): Promise<MSModel> {
        const query: MSGetQuery = {
            start: 0,
            end: 1,
            platform: MSModelPlatform.PC,
            filter: [{ type: MSGetQueryFilterType.ID, value: id }],
        };

        try {
            const res = await this.modelSaberApi.searchModel(query);

            if (res.status !== 200) {
                return null;
            }

            if (Object.keys(res.data).length === 0) {
                return null;
            }

            return res.data[`${id}`];
        } catch (e) {
            log.error(e);
            return null;
        }
    }

    public async getModelByHash(hash: string): Promise<MSModel> {
        if (this.modelsHashCache.has(hash)) {
            return this.modelsHashCache.get(hash);
        }

        const query: MSGetQuery = {
            start: 0,
            end: 1,
            platform: MSModelPlatform.PC,
            filter: [{ type: MSGetQueryFilterType.Hash, value: hash }],
        };

        try {
            const res = await this.modelSaberApi.searchModel(query);

            if (res.status !== 200) {
                return null;
            }

            if (Object.keys(res.data).length === 0) {
                return null;
            }

            const model = Array.from(Object.values(res.data)).at(0);

            model.name = striptags(model.name ?? "");
            model.author = striptags(model.author ?? "");

            this.modelsHashCache.set(hash, model);

            return model;
        } catch (e) {
            log.error(e);
            return null;
        }
    }

    public searchModels(query: MSGetQuery): Observable<MSModel[]> {
        return new Observable<MSModel[]>(observer => {
            (async () => {
                const res = await this.modelSaberApi.searchModel(query);
                if (res.status !== 200) {
                    observer.error(res.status);
                }
                observer.next(
                    Object.values(res.data).map(model => {
                        if (!model?.name) {
                            return null;
                        }
                        model.name = striptags(model.name);
                        model.author = striptags(model.author);
                        return model;
                    })
                );
            })()
                .catch(e => observer.error(e))
                .then(() => observer.complete());
        });
    }
}
