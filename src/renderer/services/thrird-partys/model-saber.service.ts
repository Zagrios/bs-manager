import { MSModel } from "shared/models/model-saber/model-saber.model";
import { IpcService } from "../ipc.service";

export class ModelSaberService {

    private static instance: ModelSaberService;

    public static getInstance(): ModelSaberService{
        if(!ModelSaberService.instance){ ModelSaberService.instance = new ModelSaberService(); }
        return ModelSaberService.instance;
    }

    private readonly ipc: IpcService;

    private constructor(){
        this.ipc = IpcService.getInstance();
    }

    public async getModelById(id: number|string): Promise<MSModel>{
        const res = await this.ipc.send<MSModel>("ms-get-model-by-id", {args: id});
        if(!res.success){ return null; }
        return res.data;
    }

}