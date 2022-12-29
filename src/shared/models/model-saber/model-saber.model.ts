export interface MSModel {
    tags: string[],
    type: MSModelType,
    name: string,
    author: string,
    thumbnail: string,
    id: number,
    hash: string,
    bsaber: string,
    status: string,
    discordid: string,
    discord?: string,
    variationid?: number,
    platform: MSModelPlatform,
    download: string,
    install_link: string,
    date: string
}

export type MSModelType = "saber"|"platform"|"bloq"|"misc"|"avatar";
export type MSModelPlatform = "pc"|"quest"|"all";

export interface MSGetQuery {
    type?: MSModelType;
    platform?: MSModelPlatform,
    start?: number,
    end?: number,
    sort?: MSGetSort,
    sortDirection?: MSGetSortDirection,
    filter?: MSGetQueryFilter[]
}

export interface MSGetQueryFilter {
    type:MSGetQueryFilterType,
    value: string|number,
    isNegative?: boolean
}

export type MSGetResponse<T extends string = string> = Record<T, MSModel>;
export type MSGetSort = "date"|"name"|"author"
export type MSGetSortDirection = "asc"|"desc"
export type MSGetQueryFilterType = "author"|"name"|"tag"|"hash"|"discordid"|"id"|"searchName"