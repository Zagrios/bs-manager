import { ObjectValues } from "shared/helpers/type.helpers";
import { SongDetailDiffCharactertistic, SongDiffName } from "./song-details-cache/song-details-cache.model";

export interface BsvMapDetail {
    automapper: boolean;
    createdAt: string;
    curatedAt: BsvInstant;
    curator: BsvUserDetail;
    deletedAt: BsvInstant;
    description: string;
    id: string;
    lastPublishedAt: BsvInstant;
    metadata: BsvMapDetailMetadata;
    name: string;
    qualified: boolean;
    ranked: boolean;
    blQualified: boolean
    blRanked: boolean
    declaredAi: ObjectValues<typeof BsvDeclaredAi>;
    stats: BsvMapStats;
    tags: MapTag[];
    updatedAt: BsvInstant;
    uploaded: BsvInstant;
    uploader: BsvUserDetail;
    versions: BsvMapVersion[];
}

export interface BsvInstant {
    epochSeconds: number;
    nanosecondsOfSecond: number;
    value: string;
}

export interface BsvUserDetail {
    admin: boolean;
    avatar: string;
    curator: boolean;
    description: string;
    email: string;
    followData: BsvUserFollowData;
    hash: string;
    id: number;
    name: string;
    stats: BsvUserStats;
    testplay: boolean;
    type: string;
    uniqueSet: boolean;
    uploadLimit: number;
    verifiedMapper: boolean;
}

export interface BsvUserFollowData {
    followers: number;
    following: boolean;
    follows: number;
}

export interface BsvUserStats {
    avgBpm: number;
    avgDuration: number;
    avgScore: number;
    diffStats: BsvUserDiffStats;
    firstUpload: BsvInstant;
    lastUpload: BsvInstant;
    rankedMaps: number;
    totalDownvotes: number;
    totalMaps: number;
    totalUpvotes: number;
}

export interface BsvUserDiffStats {
    easy: number;
    expert: number;
    expertPlus: number;
    hard: number;
    normal: number;
    total: number;
}

export interface BsvMapDetailMetadata {
    bpm: number;
    duration: number;
    levelAuthorName: string;
    songAuthorName: string;
    songName: string;
    songSubName: string;
}

export interface BsvMapStats {
    downloads: number;
    downvotes: number;
    plays: number;
    score: number;
    scoreOneDP: number;
    upvotes: number;
}

export interface BsvMapVersion {
    coverURL: string;
    createdAt: BsvInstant;
    diffs: BsvMapDifficulty[];
    downloadURL: string;
    feedback: string;
    hash: string;
    key: string;
    previewURL: string;
    sageScore: number;
    scheduledAt: BsvInstant;
    state: string;
    testplayAt: BsvInstant;
    testplays: BsvMapTestplay[];
}

export interface BsvMapTestplay {
    createdAt: BsvInstant;
    feedback: string;
    feedbackAt: BsvInstant;
    user: BsvUserDetail;
    video: string;
}

export interface BsvMapDifficulty {
    bombs: number;
    characteristic: SongDetailDiffCharactertistic;
    chroma: boolean;
    cinema: boolean;
    difficulty: SongDiffName;
    events: number;
    length: number;
    maxScore: number;
    me: boolean;
    ne: boolean;
    njs: number;
    notes: number;
    nps: number;
    obstacles: number;
    offset: number;
    paritySummary: BsvMapParitySummary;
    seconds: number;
    stars: number;
}

export interface BsvMapParitySummary {
    errors: number;
    resets: number;
    warns: number;
}

export enum MapStyle {
    Dance = "dance",
    Swing = "swing",
    Nightcore = "nightcore",
    Folk = "folk",
    Family = "family",
    Ambient = "ambient",
    Funk = "funk",
    Jazz = "jazz",
    Soul = "soul",
    Speedcore = "speedcore",
    Punk = "punk",
    Rb = "rb",
    Holiday = "holiday",
    Vocaloid = "vocaloid",
    JRock = "j-rock",
    Trance = "trance",
    DrumBass = "drumbass",
    Comedy = "comedy",
    Instrumental = "instrumental",
    Hardcore = "hardcore",
    KPop = "k-pop",
    Indie = "indie",
    Techno = "techno",
    House = "house",
    Game = "game",
    Film = "film",
    Alt = "alt",
    Dubstep = "dubstep",
    Metal = "metal",
    Anime = "anime",
    Hiphop = "hiphop",
    JPop = "j-pop",
    Rock = "rock",
    Pop = "pop",
    Electronic = "electronic",
    ClassicalOrchestral = "classical-orchestral"
}

// MapType Enum
export enum MapType {
    Accuracy = "accuracy",
    Balanced = "balanced",
    Challenge = "challenge",
    Dancestyle = "dancestyle",
    Fitness = "fitness",
    Speed = "speed",
    Tech = "tech"
}

export const MapTags = { ...MapStyle, ...MapType };
export type MapTag = MapStyle | MapType;

export enum MapRequirement {
    Chroma = "chroma",
    Noodle = "noodle",
    Me = "me",
    Cinema = "cinema"

}

export enum MapSpecificity {
    Automapper = "automapper",
    Ranked = "ranked",
    Curated = "curated",
    Verified = "verified",
    FullSpread = "fullSpread"

}

// [ Admin, Uploader, SageScore, None ]
export const BsvDeclaredAi = {
    Admin: "Admin",
    Uploader: "Uploader",
    SageScore: "SageScore",
    None: "None"
} as const;

export interface MapFilter {
    automapper?: boolean;
    chroma?: boolean;
    cinema?: boolean;
    noodle?: boolean;
    me?: boolean;
    curated?: boolean;
    verified?: boolean;
    from?: number;
    to?: number;
    fullSpread?: boolean;
    ranked?: boolean;
    installed?: boolean;
    minDuration?: number;
    maxDuration?: number;
    minNps?: number;
    maxNps?: number;
    enabledTags?: Set<MapTag>;
    excludedTags?: Set<MapTag>;
}

export interface SearchResponse {
    docs: BsvMapDetail[];
    redirect: string;
}

export interface PlaylistSearchResponse {
    docs: BsvPlaylist[];
}

export interface SearchParams {
    sortOrder: BsvSearchOrder;
    filter?: MapFilter;
    page?: number;
    q?: string;
    includeEmpty?: boolean;
}

export enum BsvSearchOrder {
    Latest = "Latest",
    Relevance = "Relevance",
    Rating = "Rating",
    Curated = "Curated"
}

export interface BsvMapDetailWithOrder {
    map: BsvMapDetail;
    order: number;
}

export interface BsvPlaylist {
    createdAt: BsvInstant;
    curatedAt: BsvInstant;
    curator: BsvUserDetail;
    deletedAt: BsvInstant;
    description: string;
    downloadURL: string;
    name: string;
    owner: BsvUserDetail;
    playlistId: number;
    playlistImage: string;
    playlistImage512: string;
    songsChangedAt: BsvInstant;
    stats: BsvPlaylistStats;
    updatedAt: BsvInstant;
    type: BsvPlaylistType;
}

export enum BsvPlaylistType {
    Private = "Private",
    Public = "Public",
    System = "System",
    Search = "Search"
}

export interface BsvPlaylistStats {
    avgScore: number;
    downVotes: number;
    mapperCount: number;
    maxNps: number;
    maxNpsTwoDP: number;
    minNps: number;
    minNpsTwoDP: number;
    scoreOneDP: number;
    totalDuration: number;
    totalMaps: number;
    upVotes: number;
}

export interface BsvPlaylistPage {
    maps: BsvMapDetailWithOrder[];
    playlist: BsvPlaylist;
}

export interface PlaylistSearchParams {
    q?: string;
    page?: number;
    sortOrder: BsvSearchOrder;
    from?: string;
    to?: string;
    minNps?: number;
    maxNps?: number;
    curated?: boolean;
    verified?: boolean;
    includeEmpty?: boolean;
}
