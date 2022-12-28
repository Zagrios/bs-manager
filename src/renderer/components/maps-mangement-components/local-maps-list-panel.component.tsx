import { MapsManagerService } from "renderer/services/maps-manager.service"
import { BSVersion } from "shared/bs-version.interface"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { Subscription } from "rxjs"
import { MapItem, ParsedMapDiff } from "./map-item.component"
import { BsvMapCharacteristic, MapFilter } from "shared/models/maps/beat-saver.model"
import { useInView } from "framer-motion"
import { MapsDownloaderService } from "renderer/services/maps-downloader.service"
import { BsmImage } from "../shared/bsm-image.component"
import BeatConflict from "../../../../assets/images/apngs/beat-conflict.png"
import { BsmButton } from "../shared/bsm-button.component"
import { useTranslation } from "renderer/hooks/use-translation.hook"

type Props = {
    version: BSVersion,
    className?: string,
    filter?: MapFilter
    search?: string,
}

export const LocalMapsListPanel = forwardRef(({version, className, filter, search} : Props, forwardRef) => {

    const mapsManager = MapsManagerService.getInstance();
    const mapsDownloader = MapsDownloaderService.getInstance();

    const ref = useRef(null)
    const isVisible = useInView(ref, {once: true});
    const [maps, setMaps] = useState<BsmLocalMap[]>([]);
    const [subs] = useState<Subscription[]>([]);
    const [selectedMaps, setSelectedMaps] = useState([]);
    const t = useTranslation();

    useImperativeHandle(forwardRef ,()=>({
        deleteMaps(){
            const mapsToDelete = selectedMaps.length === 0 ? maps : selectedMaps
            mapsManager.deleteMaps(mapsToDelete, version).finally(loadMaps);
        },
        exportMaps(){
            mapsManager.exportMaps(version, selectedMaps)
        }
    }), [selectedMaps, maps, version]);

    useEffect(() => {

        if(isVisible){
            loadMaps();
            subs.push(mapsManager.versionLinked$.subscribe(loadMaps));
            subs.push(mapsManager.versionUnlinked$.subscribe(loadMaps));
            mapsDownloader.addOnMapDownloadedListener(loadMaps);
        }
    
        return () => {
            setMaps(() => []);
            subs.forEach(s => s.unsubscribe());
            mapsDownloader.removeOnMapDownloadedListene(loadMaps);
        }
    }, [isVisible, version]);

    const loadMaps = () => {
        subs.push(mapsManager.getMaps(version).subscribe(localMaps => setMaps(() => [...localMaps])));
    }

    const handleDelete = useCallback((map: BsmLocalMap) => {
        mapsManager.deleteMaps([map], version).then(res => res && loadMaps())
    }, [version]);

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

    const onMapSelected = useCallback((map: BsmLocalMap) => {
        const maps = [...selectedMaps];
        if(maps.some(selectedMap => selectedMap.hash === map.hash)){
            const i = maps.findIndex(selectedMap => selectedMap.hash === map.hash);
            maps.splice(i, 1);
        }
        else{
            maps.push(map);
        }
        setSelectedMaps(() => maps);
    }, [selectedMaps]);

    const isMapFitFilter = (map: BsmLocalMap): boolean => {

        // Can be more clean and optimized i think
        
        const fitEnabledTags = (() => {
            if(!filter?.enabledTags || filter.enabledTags.size === 0){ return true; }
            if(!map?.bsaverInfo?.tags){ return false; }
            return Array.from(filter.enabledTags.values()).every(tag => map.bsaverInfo.tags.some(mapTag => mapTag === tag));
        })();

        if(!fitEnabledTags){ return false; }

        const fitExcluedTags = (() => {
            if(!filter?.excludedTags || filter.excludedTags.size === 0){ return true; }
            if(!map?.bsaverInfo?.tags){ return true; }
            return !map.bsaverInfo.tags.some(tag => filter.excludedTags.has(tag));
        })();

        if(!fitExcluedTags){ return false; }

        const fitMinNps = (() => {
            if(!filter?.minNps){ return true; }
            if(!map?.bsaverInfo?.versions?.at(0)){ return false; }
            return !map.bsaverInfo.versions.some(version => {
                return version.diffs.some(diff => diff.nps < filter.minNps);
            });
        })();

        if(!fitMinNps){ return false; }

        const fitMaxNps = (() => {
            if(!filter?.maxNps){ return true; }
            if(!map?.bsaverInfo?.versions?.at(0)){ return false; }
            return !map.bsaverInfo.versions.some(version => {
                return version.diffs.some(diff => diff.nps > filter.maxNps);
            });
        })();

        if(!fitMaxNps){ return false; }

        const fitMinDuration = (() => {
            if(!filter?.minDuration){ return true; }
            
            if(!map?.bsaverInfo?.metadata?.duration){ return false; }
            return map.bsaverInfo.metadata.duration >= filter.minDuration;
        })();

        if(!fitMinDuration){ return false; }

        const fitMaxDuration = (() => {
            if(!filter?.maxDuration){ return true; }
            if(!map?.bsaverInfo?.metadata?.duration){ return false; }
            return map.bsaverInfo.metadata.duration <= filter.maxDuration;
        })();

        if(!fitMaxDuration){ return false; }

        const fitNoodle = (() => {
            if(!filter?.noodle){ return true; }
            if(!map?.bsaverInfo?.versions?.at(0)){ return false; }
            return map.bsaverInfo.versions.some(version => version.diffs.some(diff => !!diff.ne));
        })();

        if(!fitNoodle){ return false; }

        const fitMe = (() => {
            if(!filter?.me){ return true; }
            if(!map?.bsaverInfo?.versions?.at(0)){ return false; }
            return map.bsaverInfo.versions.some(version => version.diffs.some(diff => !!diff.me));
        })();

        if(!fitMe){ return false; }

        const fitCinema = (() => {
            if(!filter?.cinema){ return true; }
            if(!map?.bsaverInfo?.versions?.at(0)){ return false; }
            return map.bsaverInfo.versions.some(version => version.diffs.some(diff => !!diff.cinema));
        })();

        if(!fitCinema){ return false; }

        const fitChroma =(() => {
            if(!filter?.chroma){ return true; }
            if(!map?.bsaverInfo?.versions?.at(0)){ return false; }
            return map.bsaverInfo.versions.some(version => version.diffs.some(diff => !!diff.chroma));
        })();

        if(!fitChroma){ return false; }

        const fitFullSpread = (() => {
            if(!filter?.fullSpread){ return true; }
            if(!map?.bsaverInfo?.versions?.at(0)){ return false; }
            return map.bsaverInfo.versions.some(version => version?.diffs?.length >= 5);
        })();

        if(!fitFullSpread){ return false; }

        if(!(filter?.automapper ? map.bsaverInfo?.automapper === filter.automapper : true)){ return false }
        if(!(filter?.ranked ? map.bsaverInfo?.ranked === filter.ranked : true)){ return false }
        if(!(filter?.curated ? !!map.bsaverInfo?.curatedAt : true)){ return false }
        if(!(filter?.verified ? !!map.bsaverInfo?.uploader?.verifiedMapper : true)){ return false }

        const searchCheck = (() => {
            return (
                ((map.rawInfo?._songName ?? map.bsaverInfo?.name) || "")?.toLowerCase().includes(search.toLowerCase()) || 
                ((map.rawInfo?._songAuthorName ?? map.bsaverInfo?.metadata?.songAuthorName) || "")?.toLowerCase().includes(search.toLowerCase()) ||
                ((map.rawInfo?._levelAuthorName ?? map.bsaverInfo?.metadata?.levelAuthorName) || "")?.toLowerCase().includes(search.toLowerCase()));
        })();

        if(!searchCheck){ return false };

        return true;

    }

    const renderMaps = (): JSX.Element[] => {
        return maps.reduce((acc, current) => {
            if(isMapFitFilter(current)){
                acc.push(renderMapItem(current));
            }
            return acc
        }, []);
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
            selected={selectedMaps.some(_map => _map.hash === map.hash)}
            diffs={extractMapDiffs(map)} mapId={map.bsaverInfo?.id} qualified={null} ranked={map.bsaverInfo?.ranked} autorId={map.bsaverInfo?.uploader?.id} likes={map.bsaverInfo?.stats?.upvotes} createdAt={map.bsaverInfo?.createdAt}
            onDelete={handleDelete}
            onSelected={onMapSelected}
            callBackParam={map}
        />;
    }

    return (
        <div ref={ref} className={className}>
            <ul className="p-3 w-full grow flex flex-wrap justify-center content-start gap-2 overflow-y-scroll scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900">
                {maps?.length ? renderMaps() : (
                    <div className="h-full flex flex-col items-center justify-center flex-wrap gap-1">
                        <BsmImage className="h-32" image={BeatConflict}/>
                        <span className="font-bold">{t("pages.version-viewer.maps.tabs.maps.empty-maps.text")}</span>
                        <BsmButton className="font-bold rounded-md p-2" text="pages.version-viewer.maps.tabs.maps.empty-maps.button" typeColor="primary" withBar={false} onClick={e => {e.preventDefault(); mapsDownloader.openDownloadMapModal(version)}}/>
                    </div>
                )}
            </ul>
        </div>
    )
})
