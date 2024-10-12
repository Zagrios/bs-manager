import { BsvMapCharacteristic, BsvMapDifficultyType } from "../beat-saver.model";

// interfaces/version4.ts
export interface RawMapInfoDataV4 {
    version: string;
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
    characteristic: BsvMapCharacteristic;
    difficulty: BsvMapDifficultyType;
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
