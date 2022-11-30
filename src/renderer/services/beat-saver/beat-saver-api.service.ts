import { ApiResult } from "renderer/models/api/api.model";
import { BsvMapDetail } from "shared/models/maps";
import { MapFilter, SearchOrder, SearchParams, SearchResponse } from "shared/models/maps/beat-saver.model";

export class BeatSaverApiService {

    private static instance: BeatSaverApiService;

    public static getInstance(): BeatSaverApiService{
        if(!BeatSaverApiService.instance){ BeatSaverApiService.instance = new BeatSaverApiService(); }
        return BeatSaverApiService.instance;
    }

    private readonly bsaverApiUrl = "https://beatsaver.com/api"

    private constructor(){}

    public async getMapsDetailsByHashs<T extends string>(hashs: T[]): Promise<ApiResult<Record<Lowercase<T>, BsvMapDetail>>>{
        
        if(hashs.length > 50){ throw "too musch map hashs"; }

        const paramsHashs = hashs.join(",");
        const resp = await fetch(`${this.bsaverApiUrl}/maps/hash/${paramsHashs}`);

        const data = await resp.json() as Record<Lowercase<T>, BsvMapDetail> | BsvMapDetail;

        if((data as BsvMapDetail).id){
            const key = (data as BsvMapDetail).versions.at(0).hash.toLowerCase();
            const parsedData = {
                [key]: data as BsvMapDetail
            } as Record<Lowercase<T>, BsvMapDetail>;

            return {status: resp.status, data: parsedData}
        }

        return {status: resp.status, data: (data as Record<Lowercase<T>, BsvMapDetail>)};

    }

    public async searchMaps(params: SearchParams): Promise<ApiResult<SearchResponse>>{
        
    }

}