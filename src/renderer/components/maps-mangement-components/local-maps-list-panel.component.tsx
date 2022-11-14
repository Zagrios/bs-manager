import { MapsManagerService } from "renderer/services/maps-manager.service"
import { BSVersion } from "shared/bs-version.interface"
import VisibilitySensor from "react-visibility-sensor"
import { useEffect, useRef, useState } from "react"
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { Subscription } from "rxjs"
import { MapItem, MapItemProps, ParsedMapDiff } from "./map-item.component"
import { BsvMapCharacteristic, BsvMapDifficultyType } from "shared/models/maps/beat-saver.model"
import { useInView } from "framer-motion"
import { MapsToolbar } from "./maps-toolbar.component"

type Props = {
    version: BSVersion,
    className?: string
}

export function LocalMapsListPanel({version, className} : Props) {

    const mapsManager = MapsManagerService.getInstance();

    const ref = useRef()
    const isVisible = useInView(ref, {once: true});
    const [maps, setMaps] = useState([] as BsmLocalMap[]);
    const [selectedMaps, setSelectedMaps] = useState([] as string[]);

    useEffect(() => {

        const subs: Subscription[] = [];

        if(isVisible){
            subs.push(mapsManager.getMaps(version).subscribe(localMaps => setMaps(() => [...localMaps])));
        }
    
        return () => {
            setMaps(() => []);
            console.log("DESTORYED");
            subs.forEach(s => s.unsubscribe());
        }
    }, [isVisible, version])

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

    const onMapSelected = (hash: string) => {
        const hashs = [...selectedMaps];
        if(hashs.some(selectedHash => selectedHash === hash)){
            const i = hashs.findIndex(selectedHash => selectedHash === hash);
            hashs.splice(i, 1);
        }
        else{
            hashs.push(hash);
        }
        setSelectedMaps(() => hashs);
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
            selected={selectedMaps.some(hash => hash === map.hash)}
            diffs={extractMapDiffs(map)} mapId={map.bsaverInfo?.id} qualified={null} ranked={map.bsaverInfo?.ranked} autorId={map.bsaverInfo?.uploader?.id} likes={map.bsaverInfo?.stats?.upvotes} createdAt={map.bsaverInfo?.createdAt}
            onDelete={() => {}}
            onSelected={onMapSelected}
        />;
    }

    return (
        <div ref={ref} className={className}>
            {/* <MapsToolbar className="w-full shrink-0 h-8 border-b-2 border-main-color-1"/> */}
            <ul className="p-3 w-full grow flex flex-wrap justify-center content-start gap-2 overflow-y-scroll scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900">
                {maps.map(map => renderMapItem(map))}
            </ul>
        </div>
    )
}
