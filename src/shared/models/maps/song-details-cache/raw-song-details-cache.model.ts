
// SongDetailsCache Message
export interface RawSongDetailsCache {
    songs: RawSongDetails[];
    lastUpdated: number;
    total: number;
}

// SongDetails Message
export interface RawSongDetails {
    idInt: number;
    hash: string;
    duration: number;
    uploader: RawUploader;
    uploadedAt: number;
    tags: RawMapTag[];
    ranked: boolean;
    qualified: boolean;
    curated: boolean;
    rankedBL: boolean;
    nominatedBL: boolean;
    qualifiedBL: boolean;
    upVotes: number;
    downVotes: number;
    downloads: number;
    automapper: boolean;
    difficulties: RawDifficulty[];
}

// Difficulty Message
export interface RawDifficulty {
    difficulty: RawDifficultyLabel;
    characteristic: RawDifficultyCharacteristic;
    label: string;
    starsT100: number;
    starsBlT100: number;
    njsT100: number;
    npsT100: number;
    offsetT100: number;
    chroma: boolean;
    cinema: boolean;
    me: boolean;
    ne: boolean;
    bombs: number;
    notes: number;
    obstacles: number;
}

// Uploader Message
export interface RawUploader {
    name: string;
    id: number;
    verified: boolean;
}

// DifficultyLabel Enum
export enum RawDifficultyLabel {
    UNKNOWN_LABEL,
    EASY,
    NORMAL,
    HARD,
    EXPERT,
    EXPERT_PLUS
}

// DifficultyCharacteristic Enum
export enum RawDifficultyCharacteristic {
    UNKNOWN_CHARACTERISTIC,
    STANDARD,
    ONE_SABER,
    NO_ARROWS,
    LAWLESS,
    LIGHTSHOW,
    LEGACY,
    NINETY_DEGREE,
    THREESIXTY_DEGREE
}

// MapTag Enum
export enum RawMapTag {
    UNKNOWN_TAG,
    DANCE,
    SWING,
    NIGHTCORE,
    FOLK,
    FAMILY,
    AMBIENT,
    FUNK,
    JAZZ,
    SOUL,
    SPEEDCORE,
    PUNK,
    RB,
    HOLIDAY,
    VOCALOID,
    J_ROCK,
    TRANCE,
    DRUMBASS,
    COMEDY,
    INSTRUMENTAL,
    HARDCORE,
    K_POP,
    INDIE,
    TECHNO,
    HOUSE,
    GAME,
    FILM,
    ALT,
    DUBSTEP,
    METAL,
    ANIME,
    HIPHOP,
    J_POP,
    ROCK,
    POP,
    ELECTRONIC,
    CLASSICAL_ORCHESTRAL,
    ACCURACY,
    BALANCED,
    CHALLENGE,
    DANCESTYLE,
    FITNESS,
    SPEED,
    TECH
}
