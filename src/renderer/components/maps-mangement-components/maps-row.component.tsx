import { CSSProperties } from "react"
import { BsvMapCharacteristic } from "shared/models/maps/beat-saver.model"
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { ParsedMapDiff, MapItem } from "./map-item.component"

type Props = {
    maps: BsmLocalMap[],
    style?: CSSProperties
}

export function MapsRow({maps, style}: Props) {

    const handleDelete = () => {

    }

    const onMapSelected = () => {

    }

    const extractMapDiffs = (map: BsmLocalMap): Map<BsvMapCharacteristic, ParsedMapDiff[]> => {
        const res = new Map<BsvMapCharacteristic, ParsedMapDiff[]>();
        if(map.bsaverInfo?.versions[0]?.diffs){
            map.bsaverInfo.versions[0].diffs.forEach(diff => {
                const arr = res.get(diff.characteristic) || [];
                const diffName = map.rawInfo._difficultyBeatmapSets.find(set => set._beatmapCharacteristicName === diff.characteristic)._difficultyBeatmaps.find(rawDiff => rawDiff._difficulty === diff.difficulty)?._customData?._difficultyLabel || diff.difficulty
                arr.push({name: diffName, type: diff.difficulty, stars: diff.stars});
                res.set(diff.characteristic, arr);
            });
            return res;
        }

        map.rawInfo._difficultyBeatmapSets.forEach(set => {
            set._difficultyBeatmaps.forEach(diff => {
                const arr = res.get(set._beatmapCharacteristicName) || [];
                arr.push({name: diff._customData?._difficultyLabel || diff._difficulty, type: diff._difficulty, stars: null});
                res.set(set._beatmapCharacteristicName, arr);
            });
        });

        return res;
    }

    const renderMapItem = (map: BsmLocalMap) => {
        
        return <MapItem
            key={map.hash}
            hash={map.hash}
            title={map.rawInfo._songName}
            coverUrl={map.coverUrl}
            songUrl={map.songUrl}
            autor={map.rawInfo._levelAuthorName}
            songAutor={map.rawInfo._songAuthorName}
            bpm={map.rawInfo._beatsPerMinute}
            duration={map.bsaverInfo?.metadata?.duration}
            selected={false}
            diffs={extractMapDiffs(map)} mapId={map.bsaverInfo?.id} ranked={map.bsaverInfo?.ranked} autorId={map.bsaverInfo?.uploader?.id} likes={map.bsaverInfo?.stats?.upvotes} createdAt={map.bsaverInfo?.createdAt}
            onDelete={handleDelete}
            onSelected={onMapSelected}
            callBackParam={map}
        />;
    }

    return (
        <ul className="h-fit w-full flex flex-nowrap gap-x-2" style={style}>
            {maps && maps.map(renderMapItem)}
        </ul>
  )
}
