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

    private mapFilterToUrlParams(filter: MapFilter): URLSearchParams{

        if(!filter){ return new URLSearchParams(); }

        const enbledTagsString = Array.from(filter.enabledTags);
        const excludedTagsString = Array.from(filter.excludedTags).map(tag => `!${tag}`);

        const tags = [...enbledTagsString, excludedTagsString].join("|");

        const params = {
            automapper: String(filter.automapper ?? ""),
            chroma: String(filter.chroma ?? ""),
            cinema: String(filter.cinema ?? ""),
            me: String(filter.me ?? ""),
            noodle: String(filter.noodle ?? ""),
            ranked: String(filter.ranked ?? ""),
            verified: String(filter.ranked ?? ""),
            curated: String(filter.curated ?? ""),
            fullSpread : String(filter.fullSpread ?? ""),
            from: String(filter.from ?? ""),
            to: String(filter.to ?? ""),
            tags: tags,
            minDuration: String(filter.minDuration ?? ""),
            maxDuration: String(filter.maxDuration ?? ""),
            minNps: String(filter.minNps ?? ""),
            maxNps: String(filter.maxNps ?? ""),
        };

        return new URLSearchParams(params);

    }

    private searchParamsToUrlParams(search: SearchParams): URLSearchParams{

        if(!search){ return new URLSearchParams(); }

        const searchParams = {
            includeEmpty: String(search.includeEmpty ?? ""),
            sortOrder: String(search.sortOrder ?? ""),
            q: String(search.q ?? "")
        };

        const filterUrlParms = this.mapFilterToUrlParams(search.filter);

        return new URLSearchParams({
            ...searchParams,
            ...Object.fromEntries(filterUrlParms)
        });

    }

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

    public async searchMaps(search: SearchParams): Promise<ApiResult<SearchResponse>>{

        const url = new URL(`${this.bsaverApiUrl}/search/text/${search?.page ?? 0}`);

        url.search = this.searchParamsToUrlParams(search).toString();

        const res = await fetch(url);

        console.log(res);

        if(!res.ok){
            return {status: res.status, data: null};
        }

        const data = await res.json();

        return {status: res.status, data};

    }

}