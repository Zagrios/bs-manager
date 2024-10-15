import { SongDetailDiffCharactertistic, SongDiffName } from "../song-details-cache/song-details-cache.model";

export interface RawMapInfoDataV2 {
    _version: string;
    _songName: string;
    _songSubName: string;
    _songAuthorName: string;
    _levelAuthorName: string;
    _beatsPerMinute: number;
    _shuffle: number;
    _shufflePeriod: number;
    _previewStartTime: number;
    _previewDuration: number;
    _songFilename: string;
    _coverImageFilename: string;
    _environmentName: string;
    _allDirectionsEnvironmentName: string;
    _songTimeOffset: number;
    _difficultyBeatmapSets: RawDifficultySetV2[];
    // Additional fields for 2.1.0
    _environmentNames?: string[];
    _colorSchemes?: unknown[];
}

interface RawDifficultySetV2 {
    _beatmapCharacteristicName: SongDetailDiffCharactertistic;
    _difficultyBeatmaps: RawMapDifficultyV2[];
}

interface RawMapDifficultyV2 {
    _difficulty: SongDiffName;
    _difficultyRank: number;
    _beatmapFilename: string;
    _noteJumpMovementSpeed: number;
    _noteJumpStartBeatOffset: number;
    _beatmapColorSchemeIdx?: number;
    _environmentNameIdx?: number;
    _customData?: { _difficultyLabel?: string; };
}
