import fetch from "node-fetch";
import { ApiResult } from "renderer/models/api/api.model";
import { MSGetQuery, MSGetQueryFilter, MSGetResponse } from "shared/models/model-saber/model-saber.model";

export class ModelSaberApiService {

    private static instance: ModelSaberApiService;

    public static getInstance(): ModelSaberApiService{
        if(!ModelSaberApiService.instance){ ModelSaberApiService.instance = new ModelSaberApiService(); }
        return ModelSaberApiService.instance;
    }

    private readonly API_URL = "https://modelsaber.com/api/v2/";
    private readonly ENDPOINTS = {get: "get.php", types: "types.php"};

    private constructor(){}

    private parseFilters(filters: MSGetQueryFilter[]): string{

        if(!filters){ return null; }

        const parsed = filters.map(filter => {
            const stringFilter = filter.type === "searchName" ? filter.value : `${filter.type}:${filter.value}`;
            return filter.isNegative ? `-${stringFilter}` : stringFilter;
        });

        return parsed.join(",");

    }

    private buildUrlQuery(query: MSGetQuery): URLSearchParams{

        if(!query){ return new URLSearchParams(); }

        const filterQuery = this.parseFilters(query.filter);

        const searchParams = {
            ...(query.type && {type: query.type}),
            ...(query.platform && {platform: query.platform}),
            ...(query.start && {start: `${query.start}`}),
            ...(query.end && {end: `${query.end}`}),
            ...(query.sort && {sort: query.sort}),
            ...(query.sortDirection && {sortDirection: query.sortDirection}),
            ...(filterQuery && {filter: filterQuery}),
        }

        return new URLSearchParams(searchParams);

    }

    public async searchModel(query: MSGetQuery): Promise<ApiResult<MSGetResponse>>{

        const url = new URL(this.ENDPOINTS.get, this.API_URL);

        url.search = this.buildUrlQuery(query).toString();

        const res = await fetch(url.toString());

        if(!res.ok){
            return {data: null, status: res.status};
        }

        const data = await res.json() as MSGetResponse;

        return {data, status: res.status};

    }

}