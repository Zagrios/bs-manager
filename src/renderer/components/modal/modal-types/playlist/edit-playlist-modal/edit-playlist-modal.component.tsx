import { useCallback, useMemo, useRef, useState } from "react";
import { FilterPanel, isMapFitFilter } from "renderer/components/maps-playlists-panel/maps/filter-panel.component";
import { MapItem } from "renderer/components/maps-playlists-panel/maps/map-item.component";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { VirtualScroll, VirtualScrollEndHandler } from "renderer/components/shared/virtual-scroll/virtual-scroll.component";
import { ChevronTopIcon } from "renderer/components/svgs/icons/chevron-top-icon.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { ModalComponent, ModalExitCode, ModalService } from "renderer/services/modale.service"
import { BehaviorSubject, Observable, lastValueFrom, map, take } from "rxjs";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { LocalBPList } from "shared/models/playlists/local-playlist.models"
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
import { MapIcon } from "renderer/components/svgs/icons/map-icon.component";
import { PersonIcon } from "renderer/components/svgs/icons/person-icon.component";
import { ClockIcon } from "renderer/components/svgs/icons/clock-icon.component";
import { NpsIcon } from "renderer/components/svgs/icons/nps-icon.component";
import dateFormat from 'dateformat';
import { getCorrectTextColor } from "renderer/helpers/correct-text-color";
import { BPList, BPListDifficulty, PlaylistSong } from "shared/models/playlists/playlist.interface";
import { EditPlaylistInfosModal } from "./edit-playlist-infos-modal.component";
import { CrossIcon } from "renderer/components/svgs/icons/cross-icon.component";
import { DraggableVirtualScroll } from "renderer/components/shared/virtual-scroll/draggable-virtual-scroll.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import BeatWaiting from "../../../../../../../assets/images/apngs/beat-waiting.png";
import BeatConflict from "../../../../../../../assets/images/apngs/beat-conflict.png";

type Props = {
    maps$: Observable<BsmLocalMap[]>;
    playlist?: LocalBPList;
}

type PlaylistMap = { map: (BsmLocalMap|SongDetails|BsvMapDetail), difficulties?: BPListDifficulty[] };

export const EditPlaylistModal: ModalComponent<BPList, Props> = ({ resolver, options: { data: { maps$, playlist } } }) => {

    const t = useTranslation();
    const color = useThemeColor("first-color");

    const mapsService = useService(MapsManagerService);
    const beatSaver = useService(BeatSaverService);
    const modals = useService(ModalService);

    const keyPressed$ = useConstant(() => new BehaviorSubject<string|undefined>(undefined));
    const filterContainerRef = useRef(null);

    const localMaps$ = useConstant(() => new BehaviorSubject<(BsmLocalMap|SongDetails)[]>(undefined));
    const localMaps = useObservable(() => localMaps$);

    const availabledHashsSelected$ = useConstant(() => new BehaviorSubject<string[]>([]));
    const [availableMapsSearch, setAvailableMapsSearch] = useState<string>("");
    const [availableMapsFilter, setAvailableMapsFilter] = useState<MapFilter>({});

    const [bsvLoading, setBsvLoading] = useState<boolean>(false);
    const bsvMaps$ = useConstant(() => new BehaviorSubject<BsvMapDetail[]>(undefined));
    const bsvMaps = useObservable(() => bsvMaps$);
    const [bsvSortOrder, setBsvSortOrder] = useState<BsvSearchOrder>(BsvSearchOrder.Latest);
    const [bsvSearchParams, setBsvSearchParams] = useState<SearchParams>({
        sortOrder: bsvSortOrder,
        filter: availableMapsFilter,
        page: 0,
        q: availableMapsSearch,
    });
    const sortOptions: BsmSelectOption<BsvSearchOrder>[] = useConstant(() => {
        return Object.values(BsvSearchOrder).map(sort => ({ text: `beat-saver.maps-sorts.${sort}`, value: sort }));
    });

    const playlistMaps$ = useConstant(() => new BehaviorSubject<Record<string, PlaylistMap>>(undefined));
    const playlistMaps = useObservable(() => playlistMaps$);

    const playlistHashsSelected$ = useConstant(() => new BehaviorSubject<string[]>([]));
    const [playlistMapsSearch, setPlaylistMapsSearch] = useState<string>("");
    const [playlistMapsFilter, setPlaylistMapsFilter] = useState<MapFilter>({});

    const [availableMapsSource, setAvailableMapsSource] = useState<number>(0);

    const displayablePlaylistMaps = useMemo(() => {
        if(!playlistMaps || !Object.keys(playlistMaps).length){ return []; }

        return Object.values(playlistMaps).reduce((acc, playlistMap) => {
            if(!playlistMap?.map){ return acc; }
            if(!isMapFitFilter({ map: playlistMap.map, filter: playlistMapsFilter, search: playlistMapsSearch })){ return acc; }
            acc.push(playlistMap);
            return acc;
        }, []);
    }, [playlistMaps, playlistMapsFilter, playlistMapsSearch]);

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
                const songHash = song.hash?.toLowerCase();
                const map = maps.find(map => map.hash === songHash);

                if(map){
                    acc[songHash] = { map, difficulties: song.difficulties };
                }
                else {
                    acc[songHash] = { map: undefined, difficulties: song.difficulties };
                }

                return acc;
            }, {} as Record<string, PlaylistMap>);

            const notInstalledHashs = Object.keys(playlistMapsRes).filter(hash => !playlistMapsRes[hash]?.map);
            const songsDetails = await lastValueFrom(mapsService.getMapsInfoFromHashs(notInstalledHashs));

            songsDetails.forEach(song => {
                const songHash = song.hash?.toLowerCase();
                if(playlistMapsRes[song.hash]){
                    playlistMapsRes[songHash].map = song;
                }
                else{
                    playlistMapsRes[songHash] = { map: song };
                }
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
        bsvMaps$.next(undefined);
        setBsvSearchParams({ sortOrder: bsvSortOrder, filter: availableMapsFilter, page: 0, q: availableMapsSearch });
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

    const renderMapItem = useCallback((
        map: (BsmLocalMap|BsvMapDetail|SongDetails),
        opt?: {
            onClick?: (map: (BsmLocalMap|BsvMapDetail|SongDetails)) => void,
            isSelected$?: Observable<boolean>,
            isOwned$?: Observable<boolean>,
            highlightedDiffs?: BPListDifficulty[],
            onHighlightedDiffsChange?: (diff: BPListDifficulty[]) => void
        }
    ) => {

        return (
            <MapItem
                key={(map as BsmLocalMap | SongDetails).hash ?? (map as BsvMapDetail).versions?.[0]?.hash}
                { ...MapItemComponentPropsMapper.from(map) }
                selected$={opt?.isSelected$}
                isOwned$={opt?.isOwned$}
                highlightedDiffs={opt?.highlightedDiffs}
                onSelected={opt?.onClick}
                onHighlightedDiffsChange={opt?.onHighlightedDiffsChange}
                canOpenMapDetails={false}
                canOpenAuthorDetails={false}
            />
        );
    }, []);

    const renderAvailableMapItem = useCallback((localMap: BsmLocalMap | SongDetails | BsvMapDetail) => {
        const mapHash = getHashOfMap(localMap);
        const isSelected$ = availabledHashsSelected$.pipe(map(hashs => hashs.includes(mapHash)));
        return renderMapItem(localMap, {
            onClick: () => handleOnClickMap({
                map: localMap,
                mapsSource$: localMaps$ as BehaviorSubject<(BsmLocalMap|BsvMapDetail|SongDetails)[]>,
                selectedHashs$: availabledHashsSelected$,
                noKeyPressedFallBack: () => playlistMaps$.next({...playlistMaps$.value, [mapHash]: { map: localMap }})
            }),
            isSelected$
        });
    }, []);

    const renderBsvMapItem = useCallback((bsvMap: BsvMapDetail) => {
        const mapHash = getHashOfMap(bsvMap);
        const isSelected$ = availabledHashsSelected$.pipe(map(hashs => hashs.includes(mapHash)));
        const isOwned$ = playlistMaps$.pipe(map(playlistMaps => !!playlistMaps[mapHash]));
        return renderMapItem(bsvMap, {
            onClick: () => handleOnClickMap({
                map: bsvMap,
                mapsSource$: bsvMaps$,
                selectedHashs$: availabledHashsSelected$,
                noKeyPressedFallBack: () => playlistMaps$.next({...playlistMaps$.value, [mapHash]: { map: bsvMap }})
            }),
            isSelected$,
            isOwned$
        });
    }, []);

    const renderPlaylistMapItem = useCallback((playlistMap: PlaylistMap) => {
        const mapHash = getHashOfMap(playlistMap.map);
        const isSelected$ = playlistHashsSelected$.pipe(map(hashs => hashs.includes(mapHash)));
        return renderMapItem(playlistMap.map, {
            onClick: () => handleOnClickMap({
                map: playlistMap.map,
                mapsSource$: playlistMaps$.pipe(map(Object.values)),
                selectedHashs$: playlistHashsSelected$,
                noKeyPressedFallBack: () => playlistMaps$.next(Object.fromEntries(Object.entries(playlistMaps$.value).filter(([hash]) => hash !== mapHash)))
            }),
            onHighlightedDiffsChange: diffs => {
                const newPlaylistMaps = {...playlistMaps$.value};
                newPlaylistMaps[mapHash].difficulties = diffs;
                playlistMaps$.next(newPlaylistMaps);
            },
            highlightedDiffs: playlistMap.difficulties,
            isSelected$
        });
    }, []);

    const renderList = <T, >(maps: T[], render: (item: T) => JSX.Element, scrollEndHandler?: VirtualScrollEndHandler) => {
        return (
            <VirtualScroll
                classNames={{
                    mainDiv: "size-full min-w-0",
                    rows: "py-2.5 px-2.5"
                }}
                items={maps}
                itemHeight={110}
                maxColumns={1}
                renderItem={render}
                scrollEnd={scrollEndHandler}
            />
        )
    }

    const addMapsToPlaylist = useCallback(() => {
        const tmpLocalMaps = availableMapsSource === 0 ? (localMaps$.value ?? []) : (bsvMaps$.value ?? [])
        const mapsToAdd = availabledHashsSelected$.value?.length ? (
            availabledHashsSelected$.value.map(hash => tmpLocalMaps.find(map => getHashOfMap(map) === hash)).filter(Boolean)
        ) : tmpLocalMaps;

        const newPlaylistMaps = {...playlistMaps$.value} ?? {};
        mapsToAdd.forEach(map =>{ newPlaylistMaps[getHashOfMap(map)] = { map }; });

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
        bsvMaps$.next(undefined);
        setBsvSearchParams(() => ({ ...bsvSearchParams, sortOrder: newSort }));
    };

    const loadMoreBsvMaps = () => {
        if(bsvLoading){ return; }
        setBsvSearchParams(prev => ({ ...prev, page: prev.page + 1 }));
    };

    const handleNewSearch = () => {
        if(availableMapsSource === 0){ return; }
        bsvMaps$.next(undefined);
        setBsvSearchParams(() => ({ page: 0, filter: availableMapsFilter, q: availableMapsSearch, sortOrder: bsvSortOrder}));
    }

    const playlistNbMappers = useMemo(() => {
        if(!playlistMaps || Object.keys(playlistMaps).length === 0){ return "0"; }
        const mappersSet = new Set<string>();
        Object.values(playlistMaps ?? {}).forEach(playlistMap => {

            if(!playlistMap?.map){ return; }

            const { map } = playlistMap;

            if((map as BsmLocalMap).rawInfo?._levelAuthorName){
                mappersSet.add((map as BsmLocalMap).rawInfo._levelAuthorName);
            }
            else if((map as SongDetails).uploader?.name){
                mappersSet.add((map as SongDetails).uploader.name);
            }
            else if((map as BsvMapDetail).uploader?.name){
                mappersSet.add((map as BsvMapDetail).uploader.name);
            }
        });
        return Intl.NumberFormat(undefined, { notation: "compact" }).format(mappersSet.size).trim();
    }, [playlistMaps]);

    const playlistDuration = useMemo(() => {
        if(!playlistMaps || Object.keys(playlistMaps).length === 0){ return "0:00"; }
        const durations = Object.values(playlistMaps ?? {}).map(playlistMap => {

            if(!playlistMap?.map){ return 0; }

            const { map } = playlistMap;

            if((map as BsmLocalMap)?.songDetails?.duration){
                return (map as BsmLocalMap).songDetails.duration;
            }
            if((map as SongDetails)?.duration){
                return (map as SongDetails).duration;
            }
            if((map as BsvMapDetail)?.metadata?.duration){
                return (map as BsvMapDetail).metadata.duration;
            }
            return 0;
        }).filter(duration => !Number.isNaN(duration));

        const totalDuration = durations.reduce((acc, duration) => acc + duration, 0);
        return totalDuration > 3600 ? dateFormat(totalDuration * 1000, "H:MM:ss") : dateFormat(totalDuration * 1000, "MM:ss");
    }, [playlistMaps]);

    const [playlistMinNps, playlistMaxNps] = useMemo(() => {
        if(!playlistMaps || Object.keys(playlistMaps).length === 0){ return [0, 0]; }
        const nps = Object.values(playlistMaps ?? {}).reduce((acc, playlistMap) => {

            if(!playlistMap?.map){ return acc; }

            const { map } = playlistMap;

            if(Array.isArray((map as BsmLocalMap)?.songDetails?.difficulties)){
                acc.push(...(map as BsmLocalMap).songDetails.difficulties.map(diff => diff.nps));
            }
            else if(Array.isArray((map as SongDetails)?.difficulties)){
                acc.push(...(map as SongDetails).difficulties.map(diff => diff.nps));
            }
            else if(Array.isArray((map as BsvMapDetail)?.versions?.at(0)?.diffs)){
                acc.push(...(map as BsvMapDetail).versions.flatMap(version => version.diffs.map(diff => diff.nps)));
            }
            return acc;
        }, [] as number[]).filter(n => !Number.isNaN(n));

        const minNps = Math.min(...nps);
        const maxNps = Math.max(...nps);

        const minMaxNps = [minNps === Infinity ? 0 : minNps, maxNps === -Infinity ? 0 : maxNps];

        return minMaxNps.map(n => Math.round(n * 10) / 10);
    }, [playlistMaps]);

    const handleContinue = async () => {
        const res = await modals.openModal(EditPlaylistInfosModal, { data: {
            playlistTitle: playlist?.playlistTitle ?? "",
            playlistDescription: playlist?.playlistDescription ?? "",
            base64Image: playlist?.image ?? "",
            playlistAuthor: playlist?.playlistAuthor ?? "",
            isEdit: !!playlist
        }});

        if(res.exitCode !== ModalExitCode.COMPLETED){ return; }

        const bpList: BPList = {
            image: res.data.base64Image,
            playlistAuthor: res.data.playlistAuthor,
            playlistTitle: res.data.playlistTitle,
            playlistDescription: res.data.playlistDescription,
            songs: Object.entries(playlistMaps$.value ?? []).map(([hash, playlistMap]) => {
                const props = playlistMap?.map ? MapItemComponentPropsMapper.from(playlistMap.map) : undefined;
                const playlistSong: PlaylistSong = {};

                playlistSong.hash = props?.hash ?? hash;
                if(props?.mapId){ playlistSong.key = props.mapId; }
                if(props?.title){ playlistSong.songName = props.title; }
                if(playlistMap?.difficulties){ playlistSong.difficulties = playlistMap.difficulties; }

                return playlistSong;
            })
        }

        resolver({ exitCode: ModalExitCode.COMPLETED, data: bpList});
    };

    const handlePlaylistMapDragEnd = useCallback((fromIndex: number, toIndex: number) => {
        const playlistMapsArray = Object.entries(playlistMaps$.value ?? {});
        const newPlaylistMaps = [...playlistMapsArray];
        const [removed] = newPlaylistMaps.splice(fromIndex, 1);
        newPlaylistMaps.splice(toIndex, 0, removed);

        playlistMaps$.next(Object.fromEntries(newPlaylistMaps));
    }, []);

    return (
        <div className="w-screen h-screen max-h-[calc(100vh-2rem)] max-w-[55rem] lg:max-w-[66rem] xl:max-w-[77rem] 2xl:max-w-[88rem] bg-theme-3 p-4 rounded-md relative">
            <button className="absolute top-1.5 right-1.5 size-3" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })}>
                <CrossIcon className="size-full"/>
            </button>
            {(() => {
                if(!playlistMaps || !localMaps){
                    return <div className="flex items-center justify-center w-full h-full">{t("playlist.loading")}</div>
                }
                return (
                    <div className="size-full flex flex-col justify-between">
                        <div className="grow flex flex-row min-h-0 gap-2.5">
                            <div className="flex flex-col grow basis-0 min-w-0">
                                <form className="h-8 flex flex-row gap-2 w-full mb-1.5 min-w-0" onSubmit={e => {e.preventDefault(); handleNewSearch()}}>
                                    <BsmSelect className="bg-theme-1 h-full rounded-full text-center pb-0.5" options={[{ text: t("playlist.installed"), value: 0 }, { text: "BeatSaver", value: 1 }]} onChange={setAvailableMapsSource}/>
                                    <input className="h-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2 grow pb-0.5 min-w-0" type="text" placeholder={t("pages.version-viewer.maps.search-bar.search-placeholder")} value={availableMapsSearch} onChange={e => setAvailableMapsSearch(() => e.target.value)} />
                                    {availableMapsSource === 1 && (
                                        <BsmButton className="h-full aspect-square z-[1] flex justify-center p-1 rounded-full min-w-0 shrink-0 !bg-light-main-color-1 dark:!bg-main-color-1" icon="search" onClick={handleNewSearch} withBar={false}/>
                                    )}
                                    <BsmDropdownButton ref={filterContainerRef} className="h-full aspect-square relative z-[1] flex justify-center" buttonClassName="flex items-center justify-center h-full rounded-full p-1 !bg-light-main-color-1 dark:!bg-main-color-1" icon="filter" textClassName="whitespace-nowrap" withBar={false}>
                                        <FilterPanel className="absolute top-[calc(100%+3px)] origin-top w-[500px] h-fit p-2 rounded-md shadow-md shadow-black -translate-x-1/4 lg:translate-x-0" filter={availableMapsFilter} onChange={setAvailableMapsFilter} onApply={availableMapsSource === 1 && handleNewSearch} onClose={() => filterContainerRef.current.close()}/>
                                    </BsmDropdownButton>
                                    {availableMapsSource === 1 && (
                                        <BsmSelect className="bg-theme-1 h-full rounded-full text-center pb-0.5 min-w-0 lg:min-w-fit" options={sortOptions} onChange={handleSortChange}/>
                                    )}
                                </form>

                                <div className="overflow-hidden size-full bg-theme-1 rounded-md ">
                                    {(() => {

                                        if((availableMapsSource === 1 && !Array.isArray(bsvMaps)) || (availableMapsSource === 0 && !Array.isArray(localMaps))){
                                            return (
                                                <div className="flex flex-col items-center justify-center size-full">
                                                    <BsmImage className="size-24 spin-loading" image={BeatWaiting}/>
                                                    <span className="text-sm italic leading-4">{t("playlist.loading")}</span>
                                                </div>
                                            );
                                        }

                                        if((availableMapsSource === 1 && bsvMaps.length === 0) || (availableMapsSource === 0 && localMaps.length === 0)){
                                            return (
                                                <div className="flex flex-col items-center justify-center size-full">
                                                    <BsmImage className="size-20" image={BeatConflict}/>
                                                    <span className="text-sm italic leading-4 w-3/4 text-center">{t("playlist.no-map-found")}</span>
                                                </div>
                                            );
                                        }

                                        if(availableMapsSource === 0){
                                            return renderList(localMaps.filter(map => {
                                                if(playlistMaps?.[map.hash]){ return false; }
                                                return isMapFitFilter({ map, filter: availableMapsFilter, search: availableMapsSearch });
                                            }), renderAvailableMapItem);
                                        }

                                        return renderList(bsvMaps, renderBsvMapItem, { onScrollEnd: loadMoreBsvMaps });
                                    })()}
                                </div>

                                <div className="w-full h-4 flex justify-start">
                                    <span className="text-xs italic leading-4">{t("playlist.edit-playlist-shortcuts")}</span>
                                </div>
                            </div>
                            <div className="shrink-0 flex flex-col gap-2.5 pb-4 pt-10">
                                <Tippy content={t("playlist.add-to-playlist")} theme="default" placement="left">
                                    <button className="grow w-9 rounded-md cursor-pointer transition-transform duration-150 hover:brightness-110 active:scale-95" style={{backgroundColor: color, color: getCorrectTextColor(color)}} type="button" onClick={addMapsToPlaylist}>
                                        <ChevronTopIcon className="origin-center rotate-90"/>
                                    </button>
                                </Tippy>
                                <Tippy content={t("playlist.remove-from-playlist")} theme="default" placement="right">
                                    <button className="grow w-9 rounded-md cursor-pointer transition-transform duration-150 hover:brightness-110 active:scale-95" style={{backgroundColor: color, color: getCorrectTextColor(color)}} type="button" onClick={removeMapsFromPlaylist}>
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
                                <div className="overflow-hidden size-full bg-theme-1 rounded-md">
                                    {(() => {
                                        if(!playlistMaps){
                                            return(
                                                <div className="flex flex-col items-center justify-center size-full">
                                                    <BsmImage className="size-24 spin-loading" image={BeatWaiting}/>
                                                    <span className="text-sm italic leading-4">{t("playlist.loading")}</span>
                                                </div>
                                            );
                                        }
                                        if(Object.keys(playlistMaps).length === 0){
                                            return (
                                                <div className="flex flex-col items-center justify-center size-full">
                                                    <BsmImage className="size-20" image={BeatConflict}/>
                                                    <span className="text-sm italic leading-4 w-3/4 text-center">{t("playlist.playlist-is-empty")}</span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <DraggableVirtualScroll
                                                classNames={{
                                                    mainDiv: "size-full min-w-0",
                                                    rows: "py-2.5 px-2.5"
                                                }}
                                                itemHeight={110}
                                                items={displayablePlaylistMaps}
                                                isDragDisabled={!!Object.keys(playlistMapsFilter).length || !!playlistMapsSearch}
                                                renderItem={renderPlaylistMapItem}
                                                onDragEnd={handlePlaylistMapDragEnd}
                                            />
                                        );

                                    })()}
                                </div>
                                <div className="w-full h-4 flex justify-end gap-3 mt-px">
                                    <div className="h-full flex justify-center items-center gap-0.5">
                                        <MapIcon className='h-full aspect-square mt-0.5'/>
                                        <span className="text-xs italic leading-4">{Object.keys(playlistMaps ?? {}).length}</span>
                                    </div>
                                    <div className="h-full flex justify-center items-center gap-0.5">
                                        <PersonIcon className='h-full aspect-square mt-0.5'/>
                                        <span className="text-xs italic leading-4">{playlistNbMappers}</span>
                                    </div>
                                    <div className="h-full flex justify-center items-center gap-0.5">
                                        <ClockIcon className='h-full aspect-square mt-0.5'/>
                                        <span className="text-xs italic leading-4">{playlistDuration}</span>
                                    </div>
                                    <div className="h-full flex justify-center items-center gap-0.5">
                                        <NpsIcon className='h-full aspect-square mt-0.5'/>
                                        <span className="text-xs italic leading-4">{`${playlistMinNps} - ${playlistMaxNps}`}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <footer className="flex justify-center items-center gap-2 h-8 mt-2.5">
                            <BsmButton className="rounded-md text-center h-full grow basis-0 flex justify-center items-center" typeColor="cancel" text="misc.cancel" withBar={false} onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })}/>
                            <BsmButton className="rounded-md text-center h-full grow basis-0 flex justify-center items-center" typeColor="primary" text="playlist.continue" withBar={false} onClick={handleContinue}/>
                        </footer>
                    </div>
                );
            })()}
        </div>
    )
}
