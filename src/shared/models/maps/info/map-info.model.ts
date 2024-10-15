import { SongDetailDiffCharactertistic, SongDiffName } from "../song-details-cache/song-details-cache.model";
import { RawMapInfoDataV2 } from "./raw-map-info-v2.model";
import { RawMapInfoDataV4 } from "./raw-map-info-v4.model";

export type AnyRawMapInfo = RawMapInfoDataV2 | RawMapInfoDataV4;

// interfaces/mapInfo.ts
export interface MapInfo {
    version: string;
    songName: string;
    songSubName?: string;
    songAuthorName: string;
    levelMappers: string[];
    levelLighters: string[];
    beatsPerMinute: number;
    shuffle?: number;
    shufflePeriod?: number;
    previewStartTime: number;
    previewDuration: number;
    songFilename: string;
    songPreviewFilename: string;
    coverImageFilename: string;
    environmentNames: string[];
    difficulties: MapDifficulty[];
}

export interface MapDifficulty {
    characteristic: SongDetailDiffCharactertistic;
    difficulty: SongDiffName;
    difficultyLabel?: string;
    beatmapFilename: string;
    noteJumpMovementSpeed: number;
    noteJumpStartBeatOffset: number;
    beatmapColorSchemeIdx?: number;
    environmentNameIdx?: number;
    // Additional fields from version 4.0.0
    beatmapAuthors?: {
        mappers: string[];
        lighters: string[];
    };
    lightshowDataFilename?: string;
}
