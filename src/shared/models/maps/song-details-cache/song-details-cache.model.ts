import { MapTag } from "../beat-saver.model";

export interface SongDetails {
    id: string;
    hash: string;
    name: string;
    duration: number;
    uploader: SongUploader;
    uploadedAt: number;
    tags: MapTag[];
    ranked: boolean;
    qualified: boolean;
    curated: boolean;
    blRanked: boolean;
    blQualified: boolean;
    upVotes: number;
    downVotes: number;
    downloads: number;
    automapper: boolean;
    difficulties: SongDifficulty[];
}

export interface SongDifficulty {
    difficulty: SongDiffName;
    characteristic: SongDetailDiffCharactertistic;
    label: string;
    stars: number;
    starsBL: number;
    njs: number;
    nps: number;
    offset: number;
    chroma: boolean;
    cinema: boolean;
    me: boolean;
    ne: boolean;
    bombs: number;
    notes: number;
    obstacles: number;
}

export interface SongUploader {
    name: string;
    id: number;
    verified: boolean;
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
