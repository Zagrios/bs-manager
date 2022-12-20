export interface BsvMapDetail {
    automapper: boolean,
    createdAt: string,
    curatedAt: BsvInstant,
    curator: BsvUserDetail,
    deletedAt: BsvInstant,
    description: string,
    id: string,
    lastPublishedAt: BsvInstant,
    metadata: BsvMapDetailMetadata,
    name: string,
    qualified: boolean,
    ranked: boolean,
    stats: BsvMapStats,
    tags: MapTag[],
    updatedAt: BsvInstant,
    uploaded: BsvInstant,
    uploader: BsvUserDetail,
    versions: BsvMapVersion[],
}

export interface BsvInstant {
    epochSeconds: number,
    nanosecondsOfSecond: number,
    value: string
}

export interface BsvUserDetail {
    admin: boolean,
    avatar: string,
    curator: boolean,
    description: string,
    email: string,
    followData: BsvUserFollowData,
    hash: string,
    id: number,
    name: string,
    stats: BsvUserStats,
    testplay: boolean,
    type: string,
    uniqueSet: boolean,
    uploadLimit: number,
    verifiedMapper: boolean
}

export interface BsvUserFollowData {
    followers: number,
    following: boolean,
    follows: number
}

export interface BsvUserStats {
    avgBpm: number,
    avgDuration: number,
    avgScore: number,
    diffStats: BsvUserDiffStats,
    firstUpload: BsvInstant,
    lastUpload: BsvInstant,
    rankedMaps: number,
    totalDownvotes: number,
    totalMaps: number,
    totalUpvotes: number
}

export interface BsvUserDiffStats {
    easy: number,
    expert: number,
    expertPlus: number,
    hard: number,
    normal: number,
    total: number
}

export interface BsvMapDetailMetadata {
    bpm: number,
    duration: number,
    levelAuthorName: string,
    songAuthorName: string,
    songName: string,
    songSubName: string
}

export interface BsvMapStats {
    downloads: number,
    downvotes: number,
    plays: number,
    score: number,
    scoreOneDP: number,
    upvotes: number,
}

export interface BsvMapVersion {
    coverURL: string,
    createdAt: BsvInstant,
    diffs: BsvMapDifficulty[],
    downloadURL: string,
    feedback: string,
    hash: string,
    key: string,
    previewURL: string,
    sageScore: number,
    scheduledAt: BsvInstant,
    state: string,
    testplayAt: BsvInstant,
    testplays: BsvMapTestplay[],
}

export interface BsvMapTestplay {
    createdAt: BsvInstant,
    feedback: string,
    feedbackAt: BsvInstant,
    user: BsvUserDetail,
    video: string
}

export interface BsvMapDifficulty {
    bombs: number,
    characteristic: BsvMapCharacteristic,
    chroma: boolean,
    cinema: boolean,
    difficulty: BsvMapDifficultyType,
    events: number,
    length: number,
    maxScore: number,
    me: boolean,
    ne: boolean,
    njs: number,
    notes: number,
    nps: number,
    obstacles: number,
    offset: number,
    paritySummary: BsvMapParitySummary,
    seconds: number,
    stars: number
}

export interface BsvMapParitySummary {
    errors: number,
    resets: number,
    warns: number,
}

export type BsvMapCharacteristic = ("Standard" | "OneSaber" | "NoArrows" | "90Degree" | "360Degree" | "Lightshow" | "Lawless")
export type BsvMapDifficultyType = ("Easy" | "Normal" | "Hard" | "Expert" | "ExpertPlus")

export type MapStyle = ("dance" | "swing" | "nightcore" | "folk" | "family" | "ambient" | "funk" | "jazz" | "soul" | "speedcore" | "punk" | "rb" | "holiday" | "vocaloid" | "jrock" | "trance" | "drumbass" | "comedy" | "instrumental" | "hardcore" | "kpop" | "indie" | "techno" | "house" | "game" | "film" | "alt" | "dubstep" | "metal" | "anime" | "hiphop" | "jpop" | "rock" | "pop" | "electronic" | "classical-orchestral")
export type MapType = ("accuracy" | "balanced" | "challenge" | "dancestyle" | "fitness" | "speed" | "tech")
export type MapTag = MapStyle | MapType

export type MapRequirement = ("chroma" | "noodle" | "me" | "cinema")
export type MapSpecificity = ("automapper" | "ranked" | "curated" | "verified" | "fullSpread")

export interface MapFilter {
    automapper?: boolean,
    chroma?: boolean,
    cinema?: boolean,
    noodle?: boolean,
    me?: boolean,
    curated?: boolean,
    verified?: boolean,
    from?: number,
    to?: number,
    fullSpread?: boolean,
    ranked?: boolean,
    minDuration?: number,
    maxDuration?: number,
    minNps?: number,
    maxNps?: number,
    enabledTags?: Set<MapTag>,
    excludedTags?: Set<MapTag>
}

export interface SearchResponse {
    docs: BsvMapDetail[],
    redirect: string
}

export interface SearchParams {
    sortOrder: SearchOrder,
    filter?: MapFilter, 
    page?: number, 
    q?: string,
    includeEmpty?: boolean
}

export type SearchOrder = "Latest"|"Relevance"|"Rating"|"Curated";

export interface BsvMapDetailWithOrder {
    map: BsvMapDetail,
    order: number
}

export interface BsvPlaylist {
    createdAt: BsvInstant,
    curatedAt: BsvInstant,
    curator: BsvUserDetail,
    deletedAt: BsvInstant,
    description: string,
    downloadURL: string,
    name: string,
    owner: BsvUserDetail,
    playlistId: number,
    playlistImage: string,
    playlistImage512: string,
    public: boolean,
    songsChangedAt: BsvInstant,
    stats: BsvPlaylistStats,
    updatedAt: BsvInstant,
}

export interface BsvPlaylistStats {
    avgScore: number,
    downVotes: number,
    mapperCount: number,
    maxNps: number,
    maxNpsTwoDP: number,
    minNps: number,
    minNpsTwoDP: number,
    scoreOneDP: number,
    totalDuration: number,
    totalMaps: number,
    upVotes: number
}

export interface BsvPlaylistPage {
    maps: BsvMapDetailWithOrder[],
    playlist: BsvPlaylist
}
