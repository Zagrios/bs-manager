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
import BeatWaitingImg from "../../../../assets/images/apngs/beat-waiting.png"
import { VariableSizeList } from "react-window"
import AutoSizer from "react-virtualized-auto-sizer"
import { MapsRow } from "./maps-row.component"
import { motion } from "framer-motion"

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
    const [maps, setMaps] = useState<BsmLocalMap[]>(null);
    const [subs] = useState<Subscription[]>([]);
    const [selectedMaps, setSelectedMaps] = useState([]);
    const [itemPerRow, setItemPerRow] = useState(2);
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
            setMaps(() => null);
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


    const preppedMaps: BsmLocalMap[][] = (() => {

        if(!maps){ return []; }

        //const mapsPerRow = //Math.floor(listWidth / 400);
        const res: BsmLocalMap[][] = [];
        let mapsRow: BsmLocalMap[] = []

        for(const [i, map] of maps.entries()){
            if(!isMapFitFilter(map)){ continue; }
            if(mapsRow.length === itemPerRow){
                res.push(mapsRow);
                mapsRow = [];
            }
            mapsRow.push(map);
        }

        console.log(res, "11");

        return res;
    })();

    const updateItemPerRow = (listWidth: number) => {
        const newPerRow = Math.floor(listWidth / 400);
        if(newPerRow === itemPerRow){ return; }
        console.log("AA");
        setItemPerRow(newPerRow);
    }

    return (
        <div ref={ref} className={className}>
                    <VariableSizeList width={"100%"} height={ref.current?.clientHeight ||0} itemSize={() => 100} itemCount={preppedMaps.length} itemData={preppedMaps}>
                        {(props) => <MapsRow maps={props.data[props.index]} style={props.style}/>}
                    </VariableSizeList>
            
        </div>
    )
})
