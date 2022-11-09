import { MapsManagerService } from "renderer/services/maps-manager.service"
import { BSVersion } from "shared/bs-version.interface"
import VisibilitySensor from "react-visibility-sensor"
import { useEffect, useState } from "react"
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { Subscription } from "rxjs"
import { MapItem, MapItemProps } from "./map-item.component"
import { BsvMapCharacteristic, BsvMapDifficultyType } from "shared/models/maps/beat-saver.model"

type Props = {
    version: BSVersion,
    className?: string
}

export function LocalMapsListPanel({version, className} : Props) {

    const mapsManager = MapsManagerService.getInstance();

    const [isVisible, setIsVisible] = useState(false);
    const [maps, setMaps] = useState([] as BsmLocalMap[]);

    useEffect(() => {

        const subs: Subscription[] = [];

        if(isVisible && !maps?.length){
            subs.push(mapsManager.getMaps(version).subscribe(localMaps => setMaps(() => [...localMaps])));
        }
    
        return () => { subs.forEach(s => s.unsubscribe()); }
    }, [isVisible])

    const extractMapDiffs = (map: BsmLocalMap): Map<BsvMapCharacteristic, BsvMapDifficultyType[]> => {
        const res = new Map<BsvMapCharacteristic, BsvMapDifficultyType[]>();
        map.rawInfo._difficultyBeatmapSets.forEach(set => {
            set._difficultyBeatmaps.forEach(diff => {
                const arr = res.get(set._beatmapCharacteristicName) || [];
                arr.push(diff._difficulty);
                res.set(set._beatmapCharacteristicName, arr);
            })
        })
        return res;
    }

    const renderMapItem = (map: BsmLocalMap) => {
        
        return <MapItem
            key={map.hash}
            hash={map.hash}
            title={[map.rawInfo._songAuthorName, map.rawInfo._songName].join(" - ")}
            coverUrl={map.coverUrl}
            songUrl={map.songUrl}
            autor={map.rawInfo._levelAuthorName}
            songAutor={map.rawInfo._songAuthorName}
            bpm={map.rawInfo._beatsPerMinute}
            duration={null}
            diffs={extractMapDiffs(map)} mapId={map.bsaverInfo?.id} qualified={null} ranked={null} autorLink={null}
        />;
    }

    return (
        <VisibilitySensor onChange={setIsVisible}>
            <ul className={className}>
                {maps.map(map => renderMapItem(map))}
            </ul>
        </VisibilitySensor>
    )
}
