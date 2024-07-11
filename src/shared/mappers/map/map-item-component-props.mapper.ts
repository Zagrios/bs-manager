import { getLocalTimeZone, parseAbsolute, toCalendarDateTime } from "@internationalized/date";
import { MapItemComponentProps } from "renderer/components/maps-playlists-panel/maps/map-item.component";
import { BsvMapDetail, RawMapInfoData, SongDetailDiffCharactertistic, SongDetails, SongDiffName } from "shared/models/maps";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";

export type ParsedMapDiff = { name: SongDiffName; libelle: string; stars: number };

export abstract class MapItemComponentPropsMapper {

    public static extractMapDiffs({rawMapInfo, songDetails, bsvMap}: {rawMapInfo?: RawMapInfoData, songDetails?: SongDetails, bsvMap?: BsvMapDetail}): Map<SongDetailDiffCharactertistic, ParsedMapDiff[]> {
        const res = new Map<SongDetailDiffCharactertistic, ParsedMapDiff[]>();

        if (bsvMap?.versions?.at(0)?.diffs) {
            bsvMap.versions.at(0).diffs.forEach(diff => {
                const arr = res.get(diff.characteristic) || [];
                arr.push({ libelle: diff.difficulty, name: diff.difficulty, stars: diff.stars });
                res.set(diff.characteristic, arr);
            });
            return res;
        }

        if (songDetails?.difficulties) {
            songDetails?.difficulties.forEach(diff => {
                const arr = res.get(diff.characteristic) || [];
                const diffName = rawMapInfo?._difficultyBeatmapSets?.find(set => set._beatmapCharacteristicName === diff.characteristic)._difficultyBeatmaps.find(rawDiff => rawDiff._difficulty === diff.difficulty)?._customData?._difficultyLabel || diff.difficulty;
                arr.push({ libelle: diffName, name: diff.difficulty, stars: diff.stars });
                res.set(diff.characteristic, arr);
            });
            return res;
        }

        if(rawMapInfo?._difficultyBeatmapSets){
            rawMapInfo._difficultyBeatmapSets.forEach(set => {
                set._difficultyBeatmaps.forEach(diff => {
                    const arr = res.get(set._beatmapCharacteristicName) || [];
                    arr.push({ libelle: diff._customData?._difficultyLabel || diff._difficulty, name: diff._difficulty, stars: null });
                    res.set(set._beatmapCharacteristicName, arr);
                });
            });
        }

        return res;
    }

    public static fromBsmLocalMap(map: BsmLocalMap): MapItemComponentProps<BsmLocalMap> {
        return {
            hash: map.hash,
            title: map.rawInfo._songName,
            coverUrl: map.coverUrl,
            songUrl: map.songUrl,
            autor: map.rawInfo._levelAuthorName,
            songAutor: map.rawInfo._songAuthorName,
            bpm: map.rawInfo._beatsPerMinute,
            duration: map.songDetails?.duration,
            diffs: MapItemComponentPropsMapper.extractMapDiffs({ rawMapInfo: map.rawInfo, songDetails: map.songDetails }),
            mapId: map.songDetails?.id,
            ranked: map.songDetails?.ranked,
            blRanked: map.songDetails?.blRanked,
            autorId: map.songDetails?.uploader.id,
            likes: map.songDetails?.upVotes,
            createdAt: map.songDetails?.uploadedAt,
            callBackParam: map
        }
    }

    public static fromBsvMapDetail(map: BsvMapDetail): MapItemComponentProps<BsvMapDetail> {
        return {
            autor: map.metadata.levelAuthorName,
            autorId: map.uploader.id,
            bpm: map.metadata.bpm,
            coverUrl: map.versions.at(0).coverURL,
            createdAt: map.createdAt && toCalendarDateTime(parseAbsolute(map.createdAt, getLocalTimeZone())),
            duration: map.metadata.duration,
            hash: map.versions.at(0).hash,
            likes: map.stats.upvotes,
            mapId: map.id,
            ranked: map.ranked,
            blRanked: map.blRanked,
            title: map.name,
            songAutor: map.metadata.songAuthorName,
            diffs: MapItemComponentPropsMapper.extractMapDiffs({ bsvMap: map }),
            songUrl: map.versions.at(0).previewURL,
            callBackParam: map
        }
    }

    public static fromSongDetails(song: SongDetails): MapItemComponentProps<SongDetails> {
        return {
            autor: song.uploader.name,
            autorId: song.uploader.id,
            createdAt: song.uploadedAt,
            duration: song.duration,
            hash: song.hash,
            likes: song.upVotes,
            mapId: song.id,
            ranked: song.ranked,
            blRanked: song.blRanked,
            title: song.name,
            diffs: MapItemComponentPropsMapper.extractMapDiffs({ songDetails: song }),
            callBackParam: song
        }
    }

    public static from(mapDetails: BsmLocalMap|BsvMapDetail|SongDetails): MapItemComponentProps<BsmLocalMap|BsvMapDetail|SongDetails> {
        if ((mapDetails as BsmLocalMap).rawInfo) {
            return MapItemComponentPropsMapper.fromBsmLocalMap(mapDetails as BsmLocalMap) as MapItemComponentProps<BsmLocalMap|BsvMapDetail|SongDetails>;
        }
        if ((mapDetails as BsvMapDetail).metadata) {
            return MapItemComponentPropsMapper.fromBsvMapDetail(mapDetails as BsvMapDetail) as MapItemComponentProps<BsmLocalMap|BsvMapDetail|SongDetails>;
        }
        return MapItemComponentPropsMapper.fromSongDetails(mapDetails as SongDetails) as MapItemComponentProps<BsmLocalMap|BsvMapDetail|SongDetails>;
    }

}
