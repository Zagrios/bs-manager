import { MSGetQuery, MSGetQueryFilter, MSModel } from "shared/models/model-saber/model-saber.model";
import { ModelSaberApiService } from "./model-saber-api.service";

export class ModelSaberService {

    private static instance: ModelSaberService;

    public static getInstance(): ModelSaberService{
        if(!ModelSaberService.instance){ ModelSaberService.instance = new ModelSaberService(); }
        return ModelSaberService.instance;
    }

    private readonly modelSaberApi: ModelSaberApiService;

    private constructor(){
        this.modelSaberApi = ModelSaberApiService.getInstance();
    }

    public async getModelById(id: number|string): Promise<MSModel>{

        const query: MSGetQuery = {
            start: 0,
            end: 1,
            platform: "pc",
            filter: [{type: "id", value: id}]
        }

        try{
            const res = await this.modelSaberApi.searchModel(query);

            if(res.status !== 200){ return null; }

            if(Object.keys(res.data).length === 0){
                return null;
            }

            return res.data[`${id}`];
        }
        catch(e){
            return null;
        }

    }

}