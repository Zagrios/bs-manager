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
    download: ModelDownloadURL,
    install_link: string,
    date: string
}

export type ModelDownloadURL = string;

export enum MSModelType {
    Avatar = "avatar",
    Saber = "saber",
    Platfrom = "platform",
    Bloq = "bloq"
};

export enum MSModelPlatform {
    PC = "pc",
    QUEST = "quest",
    ALL = "all"
};

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

export enum MSGetSort {
    Date = "date",
    Name = "name",
    Author = "author"
}
export enum MSGetSortDirection {
    Ascending = "asc",
    Descending = "desc"
}

export enum MSGetQueryFilterType {
    Author = "author",
    Name = "name",
    Tag = "tag",
    Hash = "hash",
    DiscordID = "discordid",
    ID = "id",
    SearchName = "searchName"
}

