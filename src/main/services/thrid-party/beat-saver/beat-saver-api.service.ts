import { ApiResult } from "renderer/models/api/api.model";
import { BsvMapDetail } from "shared/models/maps";
import { BsvPlaylist, BsvPlaylistPage, MapFilter, SearchParams, SearchResponse } from "shared/models/maps/beat-saver.model";
import  fetch from "node-fetch"

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

        const enbledTagsString = filter.enabledTags ? Array.from(filter.enabledTags) : null;
        const excludedTagsString = filter.excludedTags ? Array.from(filter.excludedTags).map(tag => `!${tag}`) : null;

        const tags = (enbledTagsString || excludedTagsString) ? [...enbledTagsString, excludedTagsString].join("|") : null;

        const params = {
            ...(filter.automapper && {automapper: String(filter.automapper)}),
            ...(filter.chroma && {chroma: String(filter.chroma)}),
            ...(filter.cinema && {cinema: String(filter.cinema)}),
            ...(filter.me && {me: String(filter.me)}),
            ...(filter.noodle && {noodle: String(filter.noodle)}),
            ...(filter.ranked && {ranked: String(filter.ranked)}),
            ...(filter.verified && {verified: String(filter.verified)}),
            ...(filter.curated && {curated: String(filter.curated)}),
            ...(filter.fullSpread && {fullSpread: String(filter.fullSpread)}),
            ...(filter.from && {from: String(filter.from)}),
            ...(filter.to && {to: String(filter.to)}),
            ...(tags && {tags: String(tags)}),
            ...(filter.minDuration && {minDuration: String(filter.minDuration)}),
            ...(filter.maxDuration && {maxDuration: String(filter.maxDuration)}),
            ...(filter.minNps && {minNps: String(filter.minNps)}),
            ...(filter.maxNps && {maxNps: String(filter.maxNps)})
        };

        return new URLSearchParams(params);

    }

    private searchParamsToUrlParams(search: SearchParams): URLSearchParams{

        if(!search){ return new URLSearchParams(); }

        const searchParams = {
            ...(search.includeEmpty && {includeEmpty: String(search.includeEmpty)}),
            ...(search.sortOrder && {sortOrder: search.sortOrder}),
            ...(search.q && {q: search.q})
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

    public async getMapDetailsById(id: string): Promise<ApiResult<BsvMapDetail>>{

        const res = await fetch(`${this.bsaverApiUrl}/maps/id/${id}`);

        const data = await res.json() as BsvMapDetail;

        return {status: res.status, data};

    }

    public async searchMaps(search: SearchParams): Promise<ApiResult<SearchResponse>>{

        const url = new URL(`${this.bsaverApiUrl}/search/text/${search?.page ?? 0}`);

        url.search = this.searchParamsToUrlParams(search).toString();

        const res = await fetch(url.toString());

        if(!res.ok){
            return {status: res.status, data: null};
        }

        const data: any = await res.json();

        return {status: res.status, data};

    }

    public async getPlaylistDetails(id: string): Promise<ApiResult<BsvPlaylist>>{

        const res = await fetch(`${this.bsaverApiUrl}/playlists/id/${id}/0`);

        const data = await res.json() as BsvPlaylistPage;

        return {status: res.status, data: data.playlist};

    }

}