import { MapsManagerService } from "renderer/services/maps-manager.service"
import { BSVersion } from "shared/bs-version.interface"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { Subscription } from "rxjs"
import { MapFilter } from "shared/models/maps/beat-saver.model"
import { useInView } from "framer-motion"
import { MapsDownloaderService } from "renderer/services/maps-downloader.service"
import { VariableSizeList } from "react-window"
import { MapsRow } from "./maps-row.component"
import { BehaviorSubject } from "rxjs"
import { debounceTime, last, map, mergeMap, throttleTime } from "rxjs/operators"
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service"
import { OsDiagnosticService } from "renderer/services/os-diagnostic.service"
import { useTranslation } from "renderer/hooks/use-translation.hook"
import BeatWaitingImg from "../../../../assets/images/apngs/beat-waiting.png"
import BeatConflict from "../../../../assets/images/apngs/beat-conflict.png"
import { BsmImage } from "../shared/bsm-image.component"
import { BsmButton } from "../shared/bsm-button.component"
import TextProgressBar from "../progress-bar/text-progress-bar.component"

type Props = {
    version: BSVersion,
    className?: string,
    filter?: MapFilter
    search?: string,
}

export const LocalMapsListPanel = forwardRef(({version, className, filter, search} : Props, forwardRef) => {

    const mapsManager = MapsManagerService.getInstance();
    const mapsDownloader = MapsDownloaderService.getInstance();
    const bsaver = BeatSaverService.getInstance();
    const os = OsDiagnosticService.getInstance();

    const t = useTranslation();
    const ref = useRef(null)
    const isVisible = useInView(ref, {once: true});
    const [maps, setMaps] = useState<BsmLocalMap[]>(null);
    const [subs] = useState<Subscription[]>([]);
    const [selectedMaps$] = useState(new BehaviorSubject<BsmLocalMap[]>([]));
    const [itemPerRow, setItemPerRow] = useState(2);
    const [listHeight, setListHeight] = useState(0);

    const [loadPercent$] = useState(new BehaviorSubject(0));

    useImperativeHandle(forwardRef ,()=>({
        deleteMaps(){
            const mapsToDelete = selectedMaps$.value.length === 0 ? maps : selectedMaps$.value;
            mapsManager.deleteMaps(mapsToDelete, version).then(res => {
                if(!res){ return; }
                removeMapsFromList(mapsToDelete);
                selectedMaps$.next([]);
            });
        },
        exportMaps(){
            mapsManager.exportMaps(version, selectedMaps$.value);
        },
        getMaps(){
            return maps;
        }
    }), [selectedMaps$.value, maps, version]);

    useEffect(() => {

        if(isVisible){
            loadMaps();
            subs.push(mapsManager.versionLinked$.subscribe(loadMaps));
            subs.push(mapsManager.versionUnlinked$.subscribe(loadMaps));
            mapsDownloader.addOnMapDownloadedListener((map, targerVersion) => {
                if(targerVersion !== version){ return; }
                setMaps(maps => maps ? [map, ...maps] : [map]);
            });
        }
    
        return () => {
            setMaps(() => null);
            loadPercent$.next(0);
            subs.forEach(s => s.unsubscribe());
            mapsDownloader.removeOnMapDownloadedListener(loadMaps);
        }
    }, [isVisible, version]);

    useEffect(() => {
        
        if(!isVisible){ return () => {}; }

        const updateItemPerRow = (listWidth: number) => {
            const newPerRow = Math.min(Math.floor(listWidth / 400), 3);
            if(newPerRow === itemPerRow){ return; }
            setItemPerRow(newPerRow);
        };

        const heightObserver$ = new BehaviorSubject(0);

        const observer = new ResizeObserver(() => {
            updateItemPerRow(ref.current?.clientWidth || 0);
            heightObserver$.next(ref.current?.clientHeight || 0)
        });

        observer.observe(ref.current);

        const sub = heightObserver$.pipe(debounceTime(100)).subscribe(setListHeight);

        return () => {
            observer.disconnect();
            sub.unsubscribe();
        }

    }, [isVisible, itemPerRow])

    const loadMaps = () => {

        setMaps(() => null);
        loadPercent$.next(0);

        const loadMapsObs$ = mapsManager.getMaps(version);

        loadMapsObs$.pipe(map(progess => {
            console.log(progess);
            return Math.floor(((progess.loaded / progess.total) * 100));
        })).subscribe(percent => loadPercent$.next(percent));

        subs.push(loadMapsObs$.pipe(
            last(),
            mergeMap(async progress => {
                if(os.isOffline){ return progress.maps; }
                const maps = progress.maps;
                const details = await bsaver.getMapDetailsFromHashs(maps.map(map => map.hash));
                return maps.map(map => {
                    map.bsaverInfo = details.find(d => d.versions.at(0).hash === map.hash);
                    return map;
                })
            })
        ).subscribe({
            next: maps => setMaps(() => maps),
            complete: () => loadPercent$.next(0)
        }));
    }

    const removeMapsFromList = (mapsToRemove: BsmLocalMap[]) => {
        const filtredMaps = maps.filter(map => !mapsToRemove.some(toDeleteMaps => map.hash === toDeleteMaps.hash));
        setMaps(() => filtredMaps);
    };

    const handleDelete = useCallback((map: BsmLocalMap) => {
        mapsManager.deleteMaps([map], version).then(res => res && removeMapsFromList([map]));
    }, [version, maps]);

    const onMapSelected = useCallback((map: BsmLocalMap) => {

        const mapsCopy = [...selectedMaps$.value];
        if(mapsCopy.some(selectedMap => selectedMap.hash === map.hash)){
            const i = mapsCopy.findIndex(selectedMap => selectedMap.hash === map.hash);
            mapsCopy.splice(i, 1);
        }
        else{
            mapsCopy.push(map);
        }

        selectedMaps$.next(mapsCopy);

    }, [selectedMaps$.value]);

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

        const res: BsmLocalMap[][] = [];
        let mapsRow: BsmLocalMap[] = []

        for(const map of maps){
            if(!isMapFitFilter(map)){ continue; }
            if(mapsRow.length === itemPerRow){
                res.push(mapsRow);
                mapsRow = [];
            }
            mapsRow.push(map);
        }

        if(mapsRow.length){
            res.push(mapsRow);
        }

        return res;
    })();

    if(!maps){
        return (
            <div ref={ref} className={className}>
                <div className="h-full flex flex-col items-center justify-center flex-wrap gap-1">
                    <BsmImage className="w-32 h-32 spin-loading" image={BeatWaitingImg}/>
                    <span className="font-bold">{t("modals.download-maps.loading-maps")}</span>
                    <TextProgressBar value$={loadPercent$}/>
                </div>
            </div>
        );
    }

    if(!maps.length){
        return (
            <div ref={ref} className={className}>
                <div className="h-full flex flex-col items-center justify-center flex-wrap gap-1">
                    <BsmImage className="h-32" image={BeatConflict}/>
                    <span className="font-bold">{t("pages.version-viewer.maps.tabs.maps.empty-maps.text")}</span>
                    <BsmButton className="font-bold rounded-md p-2" text="pages.version-viewer.maps.tabs.maps.empty-maps.button" typeColor="primary" withBar={false} onClick={e => {e.preventDefault(); mapsDownloader.openDownloadMapModal(version)}}/>
                </div>
            </div>
        );
    }
    
    return (
        <div ref={ref} className={className}>
            <VariableSizeList className="p-0 scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900" width={"100%"} height={listHeight} itemSize={() => 108} itemCount={preppedMaps.length} itemData={preppedMaps} layout="vertical" style={{scrollbarGutter: "stable both-edges"}} itemKey={(i, data) => data[i].map(map => map.hash).join()}>
                {(props) => <MapsRow maps={props.data[props.index]} style={props.style} selectedMaps$={selectedMaps$} onMapSelect={onMapSelected} onMapDelete={handleDelete}/>}
            </VariableSizeList>
        </div>
    )
})
