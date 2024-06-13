import { useCallback, useMemo, useState } from "react";
import { FilterPanel, isLocalMapFitMapFilter, isMapFitFilter } from "renderer/components/maps-playlists-panel/maps/filter-panel.component";
import { MapItem, extractMapDiffs } from "renderer/components/maps-playlists-panel/maps/map-item.component";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { BsmSelect } from "renderer/components/shared/bsm-select.component";
import { VirtualScroll } from "renderer/components/shared/virtual-scroll/virtual-scroll.component";
import { ChevronTopIcon } from "renderer/components/svgs/icons/chevron-top-icon.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { ModalComponent } from "renderer/services/modale.service"
import { Observable, filter, lastValueFrom, take } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { LocalBPList, LocalBPListsDetails } from "shared/models/playlists/local-playlist.models"
import { BsvMapDetail, SongDetails } from "shared/models/maps";
import { logRenderError } from "renderer";
import { useService } from "renderer/hooks/use-service.hook";
import { MapsManagerService } from "renderer/services/maps-manager.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { MapItemComponentPropsMapper } from "shared/mappers/map/map-item-component-props.mapper";
import { MapFilter } from "shared/models/maps/beat-saver.model";

type Props = {
    version?: BSVersion;
    maps$: Observable<BsmLocalMap[]>;
    playlist?: LocalBPList;
}

export const EditPlaylistModal: ModalComponent<LocalBPListsDetails, Props> = ({ resolver, options: { data: { version, maps$, playlist } } }) => {

    const t = useTranslation();
    const color = useThemeColor("first-color");

    const mapsService = useService(MapsManagerService);

    const maps = useObservable(() => maps$.pipe(filter(Array.isArray), take(1)), undefined);

    const [availableMapsSearch, setAvailableMapsSearch] = useState<string>("");
    const [availableMapsFilter, setAvailableMapsFilter] = useState<MapFilter>({});
    const [playlistMapsSearch, setPlaylistMapsSearch] = useState<string>("");
    const [playlistMapsFilter, setPlaylistMapsFilter] = useState<MapFilter>({});

    const [availableMapsSource, setAvailableMapsSource] = useState<number>(0);

    const [playlistMaps, setPlaylistMaps] = useState<Record<string, (BsmLocalMap|BsvMapDetail|SongDetails)>>();
    const displayablePlaylistMaps = useMemo(() => playlistMaps ? Object.values(playlistMaps).filter(Boolean) : [], [playlistMaps]);

    const availableMaps = (() => {

    })();

    useOnUpdate(() => {
        if(!maps){ return; }

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


        (async () => {
            const notInstalledHashs = Object.keys(playlistMapsRes).filter(hash => !playlistMapsRes[hash]);
            const songsDetails = await lastValueFrom(mapsService.getMapsInfoFromHashs(notInstalledHashs));

            songsDetails.forEach(song => {
                playlistMapsRes[song.hash] = song;
            });

        })()
        .catch(logRenderError)
        .finally(() => setPlaylistMaps(playlistMapsRes));
    }, [maps]);

    useOnUpdate(() => {

    }, [maps, playlistMaps, playlist]);

    const renderMapItem = useCallback((map: (BsmLocalMap|BsvMapDetail|SongDetails), onClick: (map: (BsmLocalMap|BsvMapDetail|SongDetails)) => void) => {

        return (
            <MapItem
                key={(map as BsmLocalMap | SongDetails).hash ?? (map as BsvMapDetail).versions?.[0]?.hash}
                { ...MapItemComponentPropsMapper.from(map) }
                onSelected={onClick}
            />
        );
    }, []);

    const renderAvailableMapItem = useCallback((map: BsmLocalMap) => {
        return renderMapItem(map, () => setPlaylistMaps(prev => ({ ...prev, [map.hash]: map })));
    }, []);

    const renderPlaylistMapItem = useCallback((map: (BsmLocalMap|BsvMapDetail|SongDetails)) => {
        return renderMapItem(map, () => setPlaylistMaps(prev => {

            if(!map){ return prev; }

            const hash = (map as BsmLocalMap | SongDetails).hash ? (map as BsmLocalMap|SongDetails).hash : (map as BsvMapDetail).versions?.[0]?.hash;

            if(!hash){ return prev; }

            const newPlaylistMaps = { ...prev };
            delete newPlaylistMaps[(map as BsmLocalMap).hash];
            return newPlaylistMaps;
        }));
    }, []);

    const renderList = <T, >(maps: T[], render: (item: T) => JSX.Element) => {
        return (
            <VirtualScroll
                classNames={{
                    mainDiv: "bg-theme-1 rounded-md size-full min-w-0 overflow-hidden",
                    rows: "my-2.5 px-2.5"
                }}
                items={maps}
                itemHeight={110}
                maxColumns={1}
                renderItem={render}
            />
        )
    }

    return (
        <div className="w-screen h-screen max-h-[calc(100vh-2rem)] max-w-[55rem] lg:max-w-[66rem] xl:max-w-[77rem] bg-theme-3 p-4 rounded-md">
            {(() => {
                if(!playlistMaps || !maps){
                    return <div className="flex items-center justify-center w-full h-full">Loading...</div>
                }
                else{
                    return (
                        <div className="size-full flex flex-col justify-between gap-3">
                            <header>header</header>
                            <div className="grow flex flex-row min-h-0 gap-2.5">
                                <div className="flex flex-col grow basis-0">
                                    <div className="h-8 flex flex-row gap-2 w-full mb-1.5">
                                        <BsmSelect className="bg-theme-1 h-full rounded-full text-center" options={[{ text: "Local", value: 0 }, { text: "BeatSaver", value: 1 }]} onChange={setAvailableMapsSource}/>
                                        <input className="h-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2 grow pb-0.5" type="text" placeholder={t("pages.version-viewer.maps.search-bar.search-placeholder")} value={availableMapsSearch} onChange={e => setAvailableMapsSearch(() => e.target.value)} />
                                        <BsmDropdownButton className="h-full relative z-[1] flex justify-center" buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1" icon="filter" text="pages.version-viewer.maps.search-bar.filters-btn" textClassName="whitespace-nowrap" withBar={false}>
                                            <FilterPanel className="absolute top-[calc(100%+3px)] origin-top w-[500px] h-fit p-2 rounded-md shadow-md shadow-black -translate-x-1/4 lg:translate-x-0" filter={availableMapsFilter} onChange={setAvailableMapsFilter}/>
                                        </BsmDropdownButton>
                                    </div>
                                    {renderList(maps.filter(map => {
                                        if(playlistMaps[map.hash]){ return false; }
                                        return isLocalMapFitMapFilter({ map, filter: availableMapsFilter, search: availableMapsSearch });
                                    }), renderAvailableMapItem)}
                                    <div className="w-full h-4 flex justify-end">
                                    </div>
                                </div>
                                <div className="shrink-0 flex flex-col gap-2.5 pb-4 pt-10">
                                    <button className="grow w-9 rounded-md cursor-pointer" style={{backgroundColor: color}} type="button"><ChevronTopIcon className="origin-center rotate-90"/></button>
                                    <button className="grow w-9 rounded-md cursor-pointer" style={{backgroundColor: color}} type="button"><ChevronTopIcon className="origin-center -rotate-90"/></button>
                                </div>
                                <div className="flex flex-col grow basis-0">
                                    <div className="h-8 flex flex-row gap-2 w-full mb-1.5">
                                        <input className="h-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2 grow pb-0.5" type="text" placeholder={t("pages.version-viewer.maps.search-bar.search-placeholder")} value={playlistMapsSearch} onChange={e => setPlaylistMapsSearch(() => e.target.value)} />
                                        <BsmDropdownButton className="h-full relative z-[1] flex justify-center" buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1" icon="filter" text="pages.version-viewer.maps.search-bar.filters-btn" textClassName="whitespace-nowrap" withBar={false}>
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
