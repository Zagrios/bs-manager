import { SongDetailDiffCharactertistic, SongDiffName } from "../song-details-cache/song-details-cache.model";

export interface RawMapInfoDataV3 {
    _version: `3.${number}.${number}`;
    _songName: string;
    _songSubName: string;
    _songAuthorName: string;
    _levelAuthorName: string;
    _beatsPerMinute: number;
    _songTimeOffset: number;
    _shuffle: number;
    _shufflePeriod: number;
    _previewStartTime: number;
    _previewDuration: number;
    _songFilename: string;
    _coverImageFilename: string;
    _environmentName: string;
    _environmentNames?: string[];
    _allDirectionsEnvironmentName: string;
    _difficultyBeatmapSets: RawDifficultySetV3[];
}

interface RawDifficultySetV3 {
    _beatmapCharacteristicName: SongDetailDiffCharactertistic;
    _difficultyBeatmaps: RawMapDifficultyV3[];
}

interface RawMapDifficultyV3 {
    _difficulty: SongDiffName;
    _difficultyRank: number;
    _beatmapFilename: string;
    _noteJumpMovementSpeed: number;
    _noteJumpStartBeatOffset: number;
    _beatmapColorSchemeIdx?: number;
    _environmentNameIdx?: number;
    _customData?: {
        _difficultyLabel?: string;
    }
}
