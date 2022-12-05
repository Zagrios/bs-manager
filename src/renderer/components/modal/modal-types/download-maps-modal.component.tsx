import { motion, useInView } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { FilterPanel } from "renderer/components/maps-mangement-components/filter-panel.component";
import { MapItem, ParsedMapDiff } from "renderer/components/maps-mangement-components/map-item.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { BSV_SORT_ORDER } from "renderer/partials/beat-saver/sort-order";
import { BeatSaverService } from "renderer/services/beat-saver/beat-saver.service";
import { ModalComponent } from "renderer/services/modale.service";
import { BSVersion } from "shared/bs-version.interface";
import { BsvMapCharacteristic, BsvMapDetail, MapFilter, SearchParams } from "shared/models/maps/beat-saver.model";
import BeatWaitingImg from "../../../../../assets/images/apngs/beat-waiting.png"

export const DownloadMapsModal: ModalComponent<void, BSVersion> = ({data}) => {

    const beatSaver = BeatSaverService.getInstance();

    const [filter, setFilter] = useState<MapFilter>({});
    const [query, setQuery] = useState("");
    const [maps, setMaps] = useState<BsvMapDetail[]>([]);
    const [sortOrder, setSortOrder] = useState(BSV_SORT_ORDER.at(0));

    const [searchParams, setSearchParams] = useState<SearchParams>({
        sortOrder: sortOrder,
        filter: filter,
        page: 0,
        q: query
    });

    const loaderRef = useRef(null);

    const sortOptions: BsmSelectOption[] = (() => {
        return BSV_SORT_ORDER.map(sort => ({text: sort, value: sort}));
    })();

    const loadMaps = (params: SearchParams) => {
        beatSaver.searchMaps(params).then((maps => setMaps(prev => [...prev, ...maps])));
    } 
    
    useEffect(() => {
        loadMaps(searchParams);
    }, [searchParams]);
    

    const extractMapDiffs = (map: BsvMapDetail): Map<BsvMapCharacteristic, ParsedMapDiff[]> => {
        const res = new Map<BsvMapCharacteristic, ParsedMapDiff[]>();
        if(map.versions.at(0).diffs){
            map.versions.at(0).diffs.forEach(diff => {
                const arr = res.get(diff.characteristic) || [];
                arr.push({name: diff.difficulty, type: diff.difficulty, stars: diff.stars});
                res.set(diff.characteristic, arr);
            });
            
        }
        return res;
    }

    const renderMap = (map: BsvMapDetail) => {
        return (
            <MapItem 
                autor={map.metadata.levelAuthorName}
                autorId={map.uploader.id}
                bpm={map.metadata.bpm}
                coverUrl={map.versions.at(0).coverURL}
                createdAt={map.createdAt}
                duration={map.metadata.duration}
                hash={map.versions.at(0).hash}
                likes={map.stats.upvotes}
                mapId={map.id}
                ranked={map.ranked}
                qualified={map.qualified}
                title={map.name}
                songAutor={map.metadata.songAuthorName}
                diffs={extractMapDiffs(map)}
                songUrl={map.versions.at(0).previewURL}
                key={map.id}
            />
        )
    }

    const handleSearch = () => {
        const searchParams: SearchParams = {
            sortOrder: sortOrder,
            filter: filter,
            q: query,
            page: 0,
        };

        setMaps(() => []);
        setSearchParams(() => searchParams);
    }

    const handleLoadMore = () => {
        setSearchParams((prev) => {
            return {...prev, page: prev.page + 1}
        });
    }

    return (
        <form className="text-gray-800 dark:text-gray-200 flex flex-col max-w-[95vw] w-[970px] h-[85vh] gap-3" onSubmit={e => {e.preventDefault(); handleSearch()}}>
            <div className="flex h-8 gap-2 shrink-0">
                <BsmDropdownButton className="shrink-0 h-full relative z-[1] flex justify-start" buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1 !bg-main-color-1" icon="search" text="Filtres" withBar={false}>
                    <FilterPanel className="absolute top-[calc(100%+3px)] bg-main-color-3 origin-top w-[450px] h-fit p-2 rounded-md shadow-md shadow-black" filter={filter} onChange={setFilter}/>
                </BsmDropdownButton>
                <input className="h-full bg-main-color-1 rounded-full px-2 grow pb-0.5" type="text" name="" id="" placeholder="Rechercher" value={query} onChange={e => setQuery(e.target.value.trim())}/>
                <BsmButton className="shrink-0 aspect-square rounded-full p-1 !bg-main-color-1" icon="search" withBar={false} onClick={e => {e.preventDefault(); handleSearch()}}/>
                <BsmSelect className="bg-main-color-1 rounded-full px-2 pb-0.5" options={sortOptions} onChange={setSortOrder}/>
            </div>
            <ul className="w-full grow flex content-start flex-wrap gap-2 px-2 overflow-y-scroll overflow-x-hidden scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900" >
                {maps.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <img className="w-32 h-32 spin-loading" src={BeatWaitingImg}></img>
                        <span className="text-lg">Chargement des maps...</span> {/* TODO TRANSLATE */}
                    </div>
                ) : (
                    <>
                        {maps.map(renderMap)}
                        <motion.span onViewportEnter={handleLoadMore} ref={loaderRef} className="block w-full h-8"/>
                    </>
                )}
            </ul>
        </form>
    )
}
