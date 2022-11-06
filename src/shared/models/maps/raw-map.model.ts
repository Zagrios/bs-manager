export interface RawMapInfoData<T = unknown> {
    _version: string,
    _songName: string,
    _songSubName: string,
    _songAuthorName: string,
    _levelAuthorName: string,
    _beatsPerMinute: number,
    _shuffle: number,
    _shufflePeriod: number,
    _previewStartTime: number,
    _previewDuration: number,
    _songFilename: string,
    _coverImageFilename: string,
    _environmentName: string,
    _allDirectionsEnvironmentName: string,
    _songTimeOffset: number,
    _customData: T,
    _difficultyBeatmapSets: RawDifficultySet[]
}

export interface RawDifficultySet {
    _beatmapCharacteristicName: string,
    _difficultyBeatmaps: RawMapDifficulty[]
}

export interface RawMapDifficulty {
    _difficulty: string,
    _difficultyRank: string,
    _beatmapFilename: string,
    _noteJumpMovementSpeed: number,
    _noteJumpStartBeatOffset: number
}