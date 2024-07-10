import { BsvMapDetail } from "shared/models/maps";
import { BsvPlaylistPage, MapFilter, PlaylistSearchParams, PlaylistSearchResponse, SearchParams, SearchResponse } from "shared/models/maps/beat-saver.model";
import { RequestService } from "../../request.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";

export class BeatSaverApiService {
    private static instance: BeatSaverApiService;

    public static getInstance(): BeatSaverApiService {
        if (!BeatSaverApiService.instance) {
            BeatSaverApiService.instance = new BeatSaverApiService();
        }
        return BeatSaverApiService.instance;
    }

    private readonly request: RequestService;

    private readonly bsaverApiUrl = "https://beatsaver.com/api";

    private constructor() {
        this.request = RequestService.getInstance();
    }

    private objectToStringRecord(obj: Record<string, any>): Record<string, string> {
        return Object.fromEntries(Object.entries(obj)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => [key, String(value)] as [string, string]));
    }

    private mapFilterToUrlParams(filter: MapFilter): URLSearchParams {
        if (!filter) {
            return new URLSearchParams();
        }

        const enbledTagsString = filter.enabledTags ? Array.from(filter.enabledTags) : null;
        const excludedTagsString = filter.excludedTags ? Array.from(filter.excludedTags).map(tag => `!${tag}`) : null;

        const tags = enbledTagsString || excludedTagsString ? [...enbledTagsString, excludedTagsString].join("|") : null;

        const params: Record<string, string> = this.objectToStringRecord({...filter, tags});

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
            throw new CustomError("too musch map hashs", "TOO_MUCH_MAP_HASHS");
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

    public searchMaps(search: SearchParams): Promise<SearchResponse> {
        const url = new URL(`${this.bsaverApiUrl}/search/text/${search?.page ?? 0}`);
        url.search = this.searchParamsToUrlParams(search).toString();
        return this.request.getJSON<SearchResponse>(url.toString());
    }

    public searchPlaylists(search: PlaylistSearchParams): Promise<PlaylistSearchResponse> {
        const url = new URL(`${this.bsaverApiUrl}/playlists/search/${search?.page ?? 0}`);
        url.search = new URLSearchParams(this.objectToStringRecord(search)).toString();
        return this.request.getJSON<PlaylistSearchResponse>(url.toString());
    }

    public getPlaylistDetailsById(id: string, page = 0): Promise<BsvPlaylistPage> {
        return this.request.getJSON<BsvPlaylistPage>(`${this.bsaverApiUrl}/playlists/id/${id}/${page}`);
    }
}
