
// SongDetailsCache Message
export interface RawSongDetailsCache {
    songs: RawSongDetails[];
    lastUpdated: number;
    uploaders: UploadersList;
    difficultyLabels: string[];
    total: number;
}

export interface UploadersList {
    names: string[];
    ids: number[];
}

// SongDetails Message
export interface RawSongDetails {
    idInt: number;
    hashIndices: number[];
    name: string;
    duration: number;
    uploaderRef: UploaderRef;
    uploadedAt: number;
    tags: RawMapTag[];
    ranked: boolean;
    qualified: boolean;
    curated: boolean;
    blRanked: boolean;
    blQualified: boolean;
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
    labelIndex: number;
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
export interface UploaderRef {
    uploaderRefIndex: number;
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
