import { CSSProperties, memo } from "react";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { distinctUntilChanged, map } from "rxjs/operators";
import { BehaviorSubject } from "rxjs";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { ParsedMapDiff, MapItem } from "./map-item.component";
import equal from "fast-deep-equal/es6";
import { SongDetailDiffCharactertistic, SongDetails } from "shared/models/maps/song-details-cache/song-details-cache.model";
import { BsvMapDetail, RawMapInfoData } from "shared/models/maps";

type Props = {
    maps: BsmLocalMap[];
    style?: CSSProperties;
    onMapDelete: (map: BsmLocalMap) => void;
    onMapSelect: (map: BsmLocalMap) => void;
    selectedMaps$: BehaviorSubject<BsmLocalMap[]>;
};

export const MapsRow = memo(({ maps, style, selectedMaps$, onMapSelect, onMapDelete }: Props) => {
    const selectedMaps = useObservable<BsmLocalMap[]>(() => selectedMaps$.pipe(
            map(selectedMaps => selectedMaps.filter(selected => maps.some(map => map.hash === selected.hash))),
            distinctUntilChanged(equal),
        ), []);

    const renderMapItem = (map: BsmLocalMap) => {

        return <MapItem
            key={map.path}
            hash={map.hash}
            title={map.rawInfo._songName}
            coverUrl={map.coverUrl}
            songUrl={map.songUrl}
            autor={map.rawInfo._levelAuthorName}
            songAutor={map.rawInfo._songAuthorName}
            bpm={map.rawInfo._beatsPerMinute}
            duration={map.songDetails?.duration}
            selected={selectedMaps.some(selected => selected.hash === map.hash)}
            diffs={extractMapDiffs({ rawMapInfo: map.rawInfo, songDetails: map.songDetails })}
            mapId={map.songDetails?.id}
            ranked={map.songDetails?.ranked}
            autorId={map.songDetails?.uploader.id}
            likes={map.songDetails?.upVotes}
            createdAt={map.songDetails?.uploadedAt}
            onDelete={onMapDelete}
            onSelected={onMapSelect}
            callBackParam={map}
        />;
    };

    return (
        <ul className="h-fit w-full flex flex-nowrap basis-0 gap-x-2 p-2" style={style}>
            {maps?.map(renderMapItem)}
        </ul>
    );
}, equal);

export function extractMapDiffs({rawMapInfo, songDetails, bsvMap}: {rawMapInfo?: RawMapInfoData, songDetails?: SongDetails, bsvMap?: BsvMapDetail}): Map<SongDetailDiffCharactertistic, ParsedMapDiff[]> {
    const res = new Map<SongDetailDiffCharactertistic, ParsedMapDiff[]>();
    if (bsvMap && bsvMap.versions?.at(0)?.diffs) {
        bsvMap.versions.at(0).diffs.forEach(diff => {
            const arr = res.get(diff.characteristic) || [];
            arr.push({ name: diff.difficulty, type: diff.difficulty, stars: diff.stars });
            res.set(diff.characteristic, arr);
        });
        return res;
    }

    if (songDetails?.difficulties) {
        songDetails?.difficulties.forEach(diff => {
            const arr = res.get(diff.characteristic) || [];
            const diffName = rawMapInfo._difficultyBeatmapSets.find(set => set._beatmapCharacteristicName === diff.characteristic)._difficultyBeatmaps.find(rawDiff => rawDiff._difficulty === diff.difficulty)?._customData?._difficultyLabel || diff.difficulty;
            arr.push({ name: diffName, type: diff.difficulty, stars: diff.stars });
            res.set(diff.characteristic, arr);
        });
        return res;
    }

    rawMapInfo._difficultyBeatmapSets.forEach(set => {
        set._difficultyBeatmaps.forEach(diff => {
            const arr = res.get(set._beatmapCharacteristicName) || [];
            arr.push({ name: diff._customData?._difficultyLabel || diff._difficulty, type: diff._difficulty, stars: null });
            res.set(set._beatmapCharacteristicName, arr);
        });
    });

    return res;
}
