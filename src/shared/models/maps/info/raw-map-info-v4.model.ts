import { SongDetailDiffCharactertistic, SongDiffName } from "../song-details-cache/song-details-cache.model";

// interfaces/version4.ts
export interface RawMapInfoDataV4 {
    version: `4.${number}.${number}`;
    song: {
      title: string;
      subTitle: string;
      author: string;
    };
    audio: {
      songFilename: string;
      songDuration: number;
      audioDataFilename: string;
      bpm: number;
      lufs: number;
      previewStartTime: number;
      previewDuration: number;
    };
    songPreviewFilename: string;
    coverImageFilename: string;
    environmentNames: string[];
    colorSchemes: unknown[];
    difficultyBeatmaps: RawMapDifficultyV4[];
}

interface RawMapDifficultyV4 {
    characteristic: SongDetailDiffCharactertistic;
    difficulty: SongDiffName;
    beatmapAuthors: {
        mappers: string[];
        lighters: string[];
    };
    environmentNameIdx: number;
    beatmapColorSchemeIdx: number;
    noteJumpMovementSpeed: number;
    noteJumpStartBeatOffset: number;
    beatmapDataFilename: string;
    lightshowDataFilename: string;
}
