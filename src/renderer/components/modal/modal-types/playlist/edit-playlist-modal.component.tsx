import { useCallback, useMemo, useRef, useState } from "react";
import { FilterPanel, isLocalMapFitMapFilter, isMapFitFilter } from "renderer/components/maps-playlists-panel/maps/filter-panel.component";
import { MapItem, extractMapDiffs } from "renderer/components/maps-playlists-panel/maps/map-item.component";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { VirtualScroll, VirtualScrollEndHandler } from "renderer/components/shared/virtual-scroll/virtual-scroll.component";
import { ChevronTopIcon } from "renderer/components/svgs/icons/chevron-top-icon.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { ModalComponent } from "renderer/services/modale.service"
import { BehaviorSubject, Observable, Subject, filter, lastValueFrom, map, of, take } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { LocalBPList, LocalBPListsDetails } from "shared/models/playlists/local-playlist.models"
import { BsvMapDetail, SongDetails } from "shared/models/maps";
import { logRenderError } from "renderer";
import { useService } from "renderer/hooks/use-service.hook";
import { MapsManagerService } from "renderer/services/maps-manager.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { MapItemComponentPropsMapper } from "shared/mappers/map/map-item-component-props.mapper";
import { BsvSearchOrder, MapFilter, SearchParams } from "shared/models/maps/beat-saver.model";
import { useConstant } from "renderer/hooks/use-constant.hook";
import Tippy from "@tippyjs/react";
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service";
import { BsmButton } from "renderer/components/shared/bsm-button.component";

type Props = {
    version?: BSVersion;
    maps$: Observable<BsmLocalMap[]>;
    playlist?: LocalBPList;
}

export const EditPlaylistModal: ModalComponent<LocalBPListsDetails, Props> = ({ resolver, options: { data: { version, maps$, playlist } } }) => {

    const t = useTranslation();
    const color = useThemeColor("first-color");

    const mapsService = useService(MapsManagerService);
    const beatSaver = useService(BeatSaverService);

    const keyPressed$ = useConstant(() => new BehaviorSubject<string|undefined>(undefined));
    const filterContainerRef = useRef(null);

    const localMaps$ = useConstant(() => new BehaviorSubject<(BsmLocalMap|SongDetails)[]>(undefined));
    const localMaps = useObservable(() => localMaps$, undefined);

    const availabledHashsSelected$ = useConstant(() => new BehaviorSubject<string[]>([]));
    const [availableMapsSearch, setAvailableMapsSearch] = useState<string>("");
    const [availableMapsFilter, setAvailableMapsFilter] = useState<MapFilter>({});

    const [bsvLoading, setBsvLoading] = useState<boolean>(false);
    const bsvMaps$ = useConstant(() => new BehaviorSubject<BsvMapDetail[]>(undefined));
    const bsvMaps = useObservable(() => bsvMaps$, undefined);
    const [bsvSearchOrder, setBsvSortOrder] = useState<BsvSearchOrder>(BsvSearchOrder.Latest);
    const [bsvSearchParams, setBsvSearchParams] = useState<SearchParams>({
        sortOrder: bsvSearchOrder,
        filter: availableMapsFilter,
        page: 0,
        q: availableMapsSearch,
    });
    const sortOptions: BsmSelectOption<BsvSearchOrder>[] = useConstant(() => {
        return Object.values(BsvSearchOrder).map(sort => ({ text: `beat-saver.maps-sorts.${sort}`, value: sort }));
    });

    const playlistMaps$ = useConstant(() => new BehaviorSubject<Record<string, (BsmLocalMap|SongDetails|BsvMapDetail)>>(undefined));
    const playlistMaps = useObservable(() => playlistMaps$, undefined);

    const playlistHashsSelected$ = useConstant(() => new BehaviorSubject<string[]>([]));
    const [playlistMapsSearch, setPlaylistMapsSearch] = useState<string>("");
    const [playlistMapsFilter, setPlaylistMapsFilter] = useState<MapFilter>({});

    const [availableMapsSource, setAvailableMapsSource] = useState<number>(0);


    const displayablePlaylistMaps = useMemo(() => playlistMaps ? Object.values(playlistMaps).filter(Boolean) : [], [playlistMaps]);

    useOnUpdate(() => {
        const keyDown = (e: KeyboardEvent) => keyPressed$.next(e.key);
        document.addEventListener("keydown", keyDown);

        const keyUp = () => keyPressed$.next(undefined);
        document.addEventListener("keyup", keyUp);

        return () => {
            document.removeEventListener("keydown", keyDown);
            document.removeEventListener("keyup", keyUp);
        }
    }, []);

    useOnUpdate(() => {
        (async () => {
            const maps = await lastValueFrom(maps$.pipe(take(1)));

            const playlistMapsRes = (playlist?.songs ?? []).reduce((acc, song) => {
                const map = maps.find(map => map.hash === song.hash);

                if(map){
                    acc[map.hash] = map;
                }
                else {
                    acc[song.hash] = undefined;
                }

                return acc;
            }, {} as Record<string, (BsmLocalMap|BsvMapDetail|SongDetails)>);

            const notInstalledHashs = Object.keys(playlistMapsRes).filter(hash => !playlistMapsRes[hash]);
            const songsDetails = await lastValueFrom(mapsService.getMapsInfoFromHashs(notInstalledHashs));

            songsDetails.forEach(song => {
                playlistMapsRes[song.hash] = song;
            });

            localMaps$.next([...(maps ?? []), ...(songsDetails ?? [])]);
            playlistMaps$.next(playlistMapsRes ?? {});
        })()
        .catch(logRenderError);
    }, []);

    useOnUpdate(() => {
        availabledHashsSelected$.next([]);
        setAvailableMapsFilter({});
        setAvailableMapsSearch("");
        bsvMaps$.next([]);
        setBsvSearchParams({ sortOrder: bsvSearchOrder, filter: availableMapsFilter, page: 0, q: availableMapsSearch });
    }, [availableMapsSource])

    useOnUpdate(() => {
        if(availableMapsSource === 0){ return; }

        setBsvLoading(true);

        (async () => {
            const maps = await beatSaver.searchMaps(bsvSearchParams);
            bsvMaps$.next([...(bsvMaps ?? []), ...maps]);
            setBsvLoading(false);
        })()
        .catch(logRenderError)
    }, [bsvSearchParams])

    const getHashOfMap = useCallback((map: (BsmLocalMap|BsvMapDetail|SongDetails)) => {
        return (map as BsmLocalMap | SongDetails).hash ?? (map as BsvMapDetail).versions?.[0]?.hash;
    }, []);

    const handleOnClickMap = useCallback(async ({ map, selectedHashs$, mapsSource$, noKeyPressedFallBack } : {
        map: BsmLocalMap | BsvMapDetail | SongDetails;
        mapsSource$: Observable<(BsmLocalMap|BsvMapDetail|SongDetails)[]>;
        selectedHashs$: BehaviorSubject<string[]>;
        noKeyPressedFallBack?: () => void;
    }) => {

        const keyPressed = keyPressed$.value;
        const mapHash = getHashOfMap(map);

        if(keyPressed === "Control"){
            const selectedHashs = selectedHashs$.value;
            const newSelectedHashs = selectedHashs.includes(mapHash) ? selectedHashs.filter(hash => hash !== mapHash) : [...selectedHashs, mapHash];
            return selectedHashs$.next(newSelectedHashs);
        }

        const mapsSource = await lastValueFrom(mapsSource$.pipe(take(1)));

        if(keyPressed === "Shift" && Array.isArray(mapsSource)){
            const selectedHashs = selectedHashs$.value;
            let lastSelectedMapIndex = mapsSource.findIndex(map => getHashOfMap(map) === selectedHashs.at(0));
            lastSelectedMapIndex = lastSelectedMapIndex === -1 ? 0 : lastSelectedMapIndex;
            const currentMapIndex = mapsSource.findIndex(map => getHashOfMap(map) === mapHash);
            const newSelectedHashs = mapsSource.slice(Math.min(lastSelectedMapIndex, currentMapIndex), Math.max(lastSelectedMapIndex, currentMapIndex) + 1).map(map => getHashOfMap(map));
            return selectedHashs$.next(newSelectedHashs);
        }

        noKeyPressedFallBack?.();
        selectedHashs$.next([]);
    }, []);

    const renderMapItem = useCallback((map: (BsmLocalMap|BsvMapDetail|SongDetails), onClick: (map: (BsmLocalMap|BsvMapDetail|SongDetails)) => void, isSelected$: Observable<boolean>, isOwned$?: Observable<boolean>) => {

        return (
            <MapItem
                key={(map as BsmLocalMap | SongDetails).hash ?? (map as BsvMapDetail).versions?.[0]?.hash}
                { ...MapItemComponentPropsMapper.from(map) }
                selected$={isSelected$}
                onSelected={onClick}
                isOwned$={isOwned$}
            />
        );
    }, []);

    const renderAvailableMapItem = useCallback((localMap: BsmLocalMap | SongDetails | BsvMapDetail) => {
        const mapHash = getHashOfMap(localMap);
        const isSelected$ = availabledHashsSelected$.pipe(map(hashs => hashs.includes(mapHash)));
        return renderMapItem(localMap, () => handleOnClickMap({
            map: localMap,
            mapsSource$: localMaps$ as BehaviorSubject<(BsmLocalMap|BsvMapDetail|SongDetails)[]>,
            selectedHashs$: availabledHashsSelected$,
            noKeyPressedFallBack: () => playlistMaps$.next(Object.assign({[mapHash]: localMap}, playlistMaps$.value))
        }), isSelected$);
    }, []);

    const renderBsvMapItem = useCallback((bsvMap: BsvMapDetail) => {
        const mapHash = getHashOfMap(bsvMap);
        const isSelected$ = availabledHashsSelected$.pipe(map(hashs => hashs.includes(mapHash)));
        const isOwned$ = playlistMaps$.pipe(map(playlistMaps => !!playlistMaps[mapHash]));
        return renderMapItem(bsvMap, () => handleOnClickMap({
            map: bsvMap,
            mapsSource$: bsvMaps$,
            selectedHashs$: availabledHashsSelected$,
            noKeyPressedFallBack: () => playlistMaps$.next(Object.assign({[mapHash]: bsvMap}, playlistMaps$.value))
        }), isSelected$, isOwned$);
    }, []);

    const renderPlaylistMapItem = useCallback((playlistMap: (BsmLocalMap|BsvMapDetail|SongDetails)) => {
        const mapHash = getHashOfMap(playlistMap);
        const isSelected$ = playlistHashsSelected$.pipe(map(hashs => hashs.includes(mapHash)));
        return renderMapItem(playlistMap, () => handleOnClickMap({
            map: playlistMap,
            mapsSource$: playlistMaps$.pipe(map(Object.values)),
            selectedHashs$: playlistHashsSelected$,
            noKeyPressedFallBack: () => playlistMaps$.next(Object.fromEntries(Object.entries(playlistMaps$.value).filter(([hash]) => hash !== mapHash)))
        }), isSelected$);
    }, []);

    const renderList = <T, >(maps: T[], render: (item: T) => JSX.Element, scrollEndHandler?: VirtualScrollEndHandler) => {
        return (
            <div className="overflow-hidden size-full">
                <VirtualScroll
                    classNames={{
                        mainDiv: "bg-theme-1 rounded-md size-full min-w-0",
                        rows: "my-2.5 px-2.5"
                    }}
                    items={maps}
                    itemHeight={110}
                    maxColumns={1}
                    renderItem={render}
                    scrollEnd={scrollEndHandler}
                />
            </div>
        )
    }

    const addMapsToPlaylist = useCallback(() => {
        const tmpLocalMaps = availableMapsSource === 0 ? (localMaps$.value ?? []) : (bsvMaps$.value ?? [])
        const mapsToAdd = availabledHashsSelected$.value?.length ? (
            availabledHashsSelected$.value.map(hash => tmpLocalMaps.find(map => getHashOfMap(map) === hash)).filter(Boolean)
        ) : tmpLocalMaps;

        const newPlaylistMaps = {...playlistMaps$.value} ?? {};
        mapsToAdd.forEach(map => newPlaylistMaps[getHashOfMap(map)] = map);

        playlistMaps$.next(newPlaylistMaps);
        availabledHashsSelected$.next([]);
    }, [availableMapsSource]);

    const removeMapsFromPlaylist = useCallback(() => {
        const hashsToRemove = playlistHashsSelected$.value?.length ? (
            playlistHashsSelected$.value
        ) : Object.keys(playlistMaps$.value ?? {}).filter(hash => playlistMaps$.value[hash]);

        const newPlaylistMaps = {...playlistMaps$.value};
        hashsToRemove.forEach(hash => { delete newPlaylistMaps[hash]; });

        playlistMaps$.next(newPlaylistMaps);
        playlistHashsSelected$.next([]);
    }, []);

    const handleSortChange = (newSort: BsvSearchOrder) => {
        setBsvSortOrder(() => newSort);
        bsvMaps$.next([]);
        setBsvSearchParams(() => ({ ...bsvSearchParams, sortOrder: newSort }));
    };

    const loadMoreBsvMaps = () => {
        if(bsvLoading){ return; }
        setBsvSearchParams(prev => ({ ...prev, page: prev.page + 1 }));
    };

    const handleNewSearch = () => {
        if(availableMapsSource === 0){ return; }
        bsvMaps$.next([]);
        setBsvSearchParams(() => ({ page: 0, filter: availableMapsFilter, q: availableMapsSearch, sortOrder: bsvSearchOrder}));
    }

    return (
        <div className="w-screen h-screen max-h-[calc(100vh-2rem)] max-w-[55rem] lg:max-w-[66rem] xl:max-w-[77rem] bg-theme-3 p-4 rounded-md">
            {(() => {
                if(!playlistMaps || !localMaps){
                    return <div className="flex items-center justify-center w-full h-full">Loading...</div>
                }
                else{
                    return (
                        <div className="size-full flex flex-col justify-between gap-3">
                            <header>header</header>
                            <div className="grow flex flex-row min-h-0 gap-2.5">
                                <div className="flex flex-col grow basis-0 min-w-0">
                                    <div className="h-8 flex flex-row gap-2 w-full mb-1.5 min-w-0">
                                        <BsmSelect className="bg-theme-1 h-full rounded-full text-center pb-0.5" options={[{ text: "Installée(s)", value: 0 }, { text: "BeatSaver", value: 1 }]} onChange={setAvailableMapsSource}/>
                                        <input className="h-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2 grow pb-0.5 min-w-0" type="text" placeholder={t("pages.version-viewer.maps.search-bar.search-placeholder")} value={availableMapsSearch} onChange={e => setAvailableMapsSearch(() => e.target.value)} />
                                        {availableMapsSource === 1 && (
                                            <BsmButton className="h-full aspect-square z-[1] flex justify-center p-1 rounded-full min-w-0 shrink-0" icon="search" withBar={false}/>
                                        )}
                                        <BsmDropdownButton ref={filterContainerRef} className="h-full aspect-square relative z-[1] flex justify-center" buttonClassName="flex items-center justify-center h-full rounded-full p-1 !bg-light-main-color-1 dark:!bg-main-color-1" icon="filter" textClassName="whitespace-nowrap" withBar={false}>
                                            <FilterPanel className="absolute top-[calc(100%+3px)] origin-top w-[500px] h-fit p-2 rounded-md shadow-md shadow-black -translate-x-1/4 lg:translate-x-0" filter={availableMapsFilter} onChange={setAvailableMapsFilter} onApply={availableMapsSource === 1 && handleNewSearch} onClose={() => filterContainerRef.current.close()}/>
                                        </BsmDropdownButton>
                                        {availableMapsSource === 1 && (
                                            <BsmSelect className="bg-theme-1 h-full rounded-full text-center pb-0.5 min-w-0 lg:min-w-fit" options={sortOptions} onChange={handleSortChange}/>
                                        )}
                                    </div>

                                    {availableMapsSource === 0 ? (
                                        renderList(localMaps.filter(map => {
                                            if(playlistMaps?.[map.hash]){ return false; }
                                            return isMapFitFilter({ map, filter: availableMapsFilter, search: availableMapsSearch });
                                        }), renderAvailableMapItem)
                                    ) : (
                                        renderList(bsvMaps, renderBsvMapItem, { onScrollEnd: loadMoreBsvMaps })
                                    )}
                                    <div className="w-full h-4 flex justify-end"/>
                                </div>
                                <div className="shrink-0 flex flex-col gap-2.5 pb-4 pt-10">
                                    <Tippy content="Ajouter à la playlist" theme="default" placement="left">
                                        <button className="grow w-9 rounded-md cursor-pointer transition-transform duration-150 hover:brightness-110 active:scale-95" style={{backgroundColor: color}} type="button" onClick={addMapsToPlaylist}>
                                            <ChevronTopIcon className="origin-center rotate-90"/>
                                        </button>
                                    </Tippy>
                                    <Tippy content="Enlever de la playlist" theme="default" placement="right">
                                        <button className="grow w-9 rounded-md cursor-pointer transition-transform duration-150 hover:brightness-110 active:scale-95" style={{backgroundColor: color}} type="button" onClick={removeMapsFromPlaylist}>
                                            <ChevronTopIcon className="origin-center -rotate-90"/>
                                        </button>
                                    </Tippy>
                                </div>
                                <div className="flex flex-col grow basis-0">
                                    <div className="h-8 flex flex-row gap-2 w-full mb-1.5">
                                        <input className="h-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2 grow pb-0.5" type="text" placeholder={t("pages.version-viewer.maps.search-bar.search-placeholder")} value={playlistMapsSearch} onChange={e => setPlaylistMapsSearch(() => e.target.value)} />
                                        <BsmDropdownButton className="h-full aspect-square relative z-[1] flex justify-center" buttonClassName="flex items-center justify-center h-full rounded-full p-1 !bg-light-main-color-1 dark:!bg-main-color-1" icon="filter" textClassName="whitespace-nowrap" withBar={false}>
                                            <FilterPanel className="absolute top-[calc(100%+3px)] origin-top w-[500px] h-fit p-2 rounded-md shadow-md shadow-black -translate-x-[40%]" filter={playlistMapsFilter} onChange={setPlaylistMapsFilter}/>
                                        </BsmDropdownButton>
                                    </div>
                                    {renderList(displayablePlaylistMaps.filter(map => {
                                        return isMapFitFilter({ map, filter: playlistMapsFilter, search: playlistMapsSearch });
                                    }), renderPlaylistMapItem)}
                                    <div className="w-full h-4 flex justify-end">
                                        <span className="text-xs italic leading-4">{Object.keys(playlistMaps ?? {}).length} Maps</span>
                                    </div>
                                </div>
                            </div>
                            <footer>footer</footer>
                        </div>
                    )
                }
            })()}
        </div>
    )
}
