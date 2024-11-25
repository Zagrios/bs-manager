import { BsvMapDetail } from "shared/models/maps";
import { BsvPlaylist, BsvPlaylistPage, MapFilter, SearchParams, SearchResponse } from "shared/models/maps/beat-saver.model";
import { RequestService } from "../../request.service";

export class BeatSaverApiService {
    private static instance: BeatSaverApiService;

    public static getInstance(): BeatSaverApiService {
        if (!BeatSaverApiService.instance) {
            BeatSaverApiService.instance = new BeatSaverApiService();
        }
        return BeatSaverApiService.instance;
    }

    private readonly request: RequestService;

    private readonly bsaverApiUrl = "https://api.beatsaver.com";

    private constructor() {
        this.request = RequestService.getInstance();
    }

    private mapFilterToUrlParams(filter: MapFilter): URLSearchParams {
        if (!filter) {
            return new URLSearchParams();
        }

        const enbledTagsString = filter.enabledTags ? Array.from(filter.enabledTags) : null;
        const excludedTagsString = filter.excludedTags ? Array.from(filter.excludedTags).map(tag => `!${tag}`) : null;

        const tags = enbledTagsString || excludedTagsString ? [...enbledTagsString, excludedTagsString].join("|") : null;

        const params = {
            ...(filter.automapper && { automapper: String(filter.automapper) }),
            ...(filter.chroma && { chroma: String(filter.chroma) }),
            ...(filter.cinema && { cinema: String(filter.cinema) }),
            ...(filter.me && { me: String(filter.me) }),
            ...(filter.noodle && { noodle: String(filter.noodle) }),
            ...(filter.ranked && { ranked: String(filter.ranked) }),
            ...(filter.verified && { verified: String(filter.verified) }),
            ...(filter.curated && { curated: String(filter.curated) }),
            ...(filter.fullSpread && { fullSpread: String(filter.fullSpread) }),
            ...(filter.from && { from: String(filter.from) }),
            ...(filter.to && { to: String(filter.to) }),
            ...(tags && { tags: String(tags) }),
            ...(filter.minDuration && { minDuration: String(filter.minDuration) }),
            ...(filter.maxDuration && { maxDuration: String(filter.maxDuration) }),
            ...(filter.minNps && { minNps: String(filter.minNps) }),
            ...(filter.maxNps && { maxNps: String(filter.maxNps) }),
        };

        delete params.enabledTags;
        delete params.excludedTags;

        return new URLSearchParams(params);
    }

    private searchParamsToUrlParams(search: SearchParams): URLSearchParams {
        if (!search) {
            return new URLSearchParams();
        }

        const searchParams = {
            ...(search.includeEmpty && { includeEmpty: String(search.includeEmpty) }),
            ...(search.sortOrder && { sortOrder: search.sortOrder }),
            ...(search.q && { q: search.q }),
        };

        const filterUrlParms = this.mapFilterToUrlParams(search.filter);

        return new URLSearchParams({
            ...searchParams,
            ...Object.fromEntries(filterUrlParms),
        });
    }

    public async getMapsDetailsByHashs<T extends string>(hashs: T[]): Promise<Record<Lowercase<T>, BsvMapDetail>> {
        if (hashs.length > 50) {
            throw "too musch map hashs";
        }

        const paramsHashs = hashs.join(",");
        const data = await this.request.getJSON<Record<Lowercase<T>, BsvMapDetail> | BsvMapDetail>(`${this.bsaverApiUrl}/maps/hash/${paramsHashs}`);

        if ((data as BsvMapDetail).id) {
            const key = (data as BsvMapDetail).versions.at(0).hash.toLowerCase();
            const parsedData = {
                [key]: data as BsvMapDetail,
            } as Record<Lowercase<T>, BsvMapDetail>;

            return parsedData
        }

        return data as Record<Lowercase<T>, BsvMapDetail>;
    }

    public async getMapDetailsById(id: string): Promise<BsvMapDetail> {
        return this.request.getJSON<BsvMapDetail>(`${this.bsaverApiUrl}/maps/id/${id}`);
    }

    public async searchMaps(search: SearchParams): Promise<SearchResponse> {
        const url = new URL(`${this.bsaverApiUrl}/search/text/${search?.page ?? 0}`);
        url.search = this.searchParamsToUrlParams(search).toString();
        return this.request.getJSON<SearchResponse>(url.toString());
    }

    public async getPlaylistDetails(id: string): Promise<BsvPlaylist> {
        const res = await this.request.getJSON<BsvPlaylistPage>(`${this.bsaverApiUrl}/playlists/id/${id}/0`);
        return res.playlist;
    }
}
