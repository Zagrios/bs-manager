

export interface SongDetailsCache {
    songs: SongDetails[];
    lastUpdated: number; // int64 in protobuf is represented as number in TypeScript, but consider using BigInt for precise representation
    total: number; // uint32
}

export interface SongDetails {
    id: string;
    hash: string;
    name: string;
    metadata: MapDetailMetadata;
    uploader: Uploader;
    uploadedAt: number; // int32
    tags: string[];
    bpm: number; // float
    ranked: boolean;
    qualified: boolean;
    curated: boolean;
    rankedBL: boolean;
    nominatedBL: boolean;
    qualifiedBL: boolean;
    upVotes: number; // int32
    downVotes: number; // int32
    downloads: number; // int32
    duration: number; // int32
    automapper: boolean;
    difficulties: Difficulty[];
}

export interface Difficulty {
    difficulty: SongDiffName;
    characteristic: SongDetailDiffCharactertistic;
    label: string;
    stars: number; // float
    starsBL: number; // float
    njs: number; // float
    nps: number; // float
    offset: number; // float
    chroma: boolean;
    cinema: boolean;
    me: boolean;
    ne: boolean;
    bombs: number; // int32
    notes: number; // int32
    obstacles: number; // int32
}

export interface Uploader {
    name: string;
    id: number; // int32
    verified: boolean;
}

export interface MapDetailMetadata {
    bpm: number; // float
    duration: number; // int32
    levelAuthorName: string;
    songAuthorName: string;
    songName: string;
    songSubName: string;
}

export enum SongDiffName {
    Easy = "Easy",
    Normal = "Normal",
    Hard = "Hard",
    Expert = "Expert",
    ExpertPlus = "ExpertPlus",
}

export enum SongDetailDiffCharactertistic {
    Standard = "Standard",
    OneSaber = "OneSaber",
    NoArrows = "NoArrows",
    Lawless = "Lawless",
    Lightshow = "Lightshow",
    Legacy = "Legacy",
    _90Degree = "90Degree",
    _360Degree = "360Degree",
}
