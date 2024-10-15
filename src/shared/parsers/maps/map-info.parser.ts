import { MapDifficulty, MapInfo, AnyRawMapInfo } from "shared/models/maps/info/map-info.model";
import { RawMapInfoDataV2 } from "shared/models/maps/info/raw-map-info-v2.model";
import { RawMapInfoDataV4 } from "shared/models/maps/info/raw-map-info-v4.model";

function parseVersion2(data: RawMapInfoDataV2): MapInfo {
    return {
        version: data._version,
        songName: data._songName,
        songSubName: data._songSubName,
        songAuthorName: data._songAuthorName,
        levelMappers: [data._levelAuthorName],
        levelLighters: [],
        beatsPerMinute: data._beatsPerMinute,
        shuffle: data._shuffle,
        shufflePeriod: data._shufflePeriod,
        previewStartTime: data._previewStartTime,
        previewDuration: data._previewDuration,
        songFilename: data._songFilename,
        songPreviewFilename: data._songFilename,
        coverImageFilename: data._coverImageFilename,
        environmentNames: data._environmentNames || [data._environmentName],
        difficulties: data._difficultyBeatmapSets.flatMap(set =>
            set._difficultyBeatmaps.map<MapDifficulty>((diff) => ({
                    characteristic: set._beatmapCharacteristicName,
                    difficulty: diff._difficulty,
                    difficultyLabel: diff._customData?._difficultyLabel,
                    beatmapFilename: diff._beatmapFilename,
                    noteJumpMovementSpeed: diff._noteJumpMovementSpeed,
                    noteJumpStartBeatOffset: diff._noteJumpStartBeatOffset,
                    beatmapColorSchemeIdx: diff._beatmapColorSchemeIdx,
                    environmentNameIdx: diff._environmentNameIdx,
            }))
        ),
    };
}

function parseVersion4(data: RawMapInfoDataV4): MapInfo {
    return {
        version: data.version,
        songName: data.song.title,
        songSubName: data.song.subTitle,
        songAuthorName: data.song.author,
        levelMappers: data.difficultyBeatmaps.flatMap(diff => diff.beatmapAuthors.mappers),
        levelLighters: data.difficultyBeatmaps.flatMap(diff => diff.beatmapAuthors.lighters),
        beatsPerMinute: data.audio.bpm,
        previewStartTime: data.audio.previewStartTime,
        previewDuration: data.audio.previewDuration,
        songFilename: data.audio.songFilename,
        songPreviewFilename: data.songPreviewFilename,
        coverImageFilename: data.coverImageFilename,
        environmentNames: data.environmentNames,
        difficulties: data.difficultyBeatmaps.map<MapDifficulty>(diff => ({
            characteristic: diff.characteristic,
            difficulty: diff.difficulty,
            beatmapFilename: diff.beatmapDataFilename,
            noteJumpMovementSpeed: diff.noteJumpMovementSpeed,
            noteJumpStartBeatOffset: diff.noteJumpStartBeatOffset,
            beatmapColorSchemeIdx: diff.beatmapColorSchemeIdx,
            environmentNameIdx: diff.environmentNameIdx,
            beatmapAuthors: diff.beatmapAuthors,
            lightshowDataFilename: diff.lightshowDataFilename,
      })),
    };
}

export function parseMapInfoDat(info: AnyRawMapInfo): MapInfo | never {
    const version = (info as RawMapInfoDataV2)?._version || (info as RawMapInfoDataV4)?.version;

    if(!version) {
        throw new Error('Cannot determine info.dat version');
    }

    if (version.startsWith('2.')) {
        return parseVersion2(info as RawMapInfoDataV2);
    }

    if (version.startsWith('4.')) {
        return parseVersion4(info as RawMapInfoDataV4);
    }

    throw new Error(`Unsupported info.dat version: ${version}`);
}
