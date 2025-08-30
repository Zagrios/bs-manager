import { useCallback, useEffect, useRef, useState } from "react";
import { FilterPanel } from "renderer/components/maps-playlists-panel/maps/filter-panel.component";
import { MapItem } from "renderer/components/maps-playlists-panel/maps/map-item.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import { ModalComponent } from "renderer/services/modale.service";
import { BSVersion } from "shared/bs-version.interface";
import { BsvMapDetail, MapFilter, BsvSearchOrder, SearchParams } from "shared/models/maps/beat-saver.model";
import BeatWaitingImg from "../../../../../assets/images/apngs/beat-waiting.png";
import BeatConflictImg from "../../../../../assets/images/apngs/beat-conflict.png";
import equal from "fast-deep-equal/es6";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { useService } from "renderer/hooks/use-service.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { getLocalTimeZone, parseAbsolute, toCalendarDateTime } from "@internationalized/date";
import { VirtualScroll } from "renderer/components/shared/virtual-scroll/virtual-scroll.component";
import { MapItemComponentPropsMapper } from "shared/mappers/map/map-item-component-props.mapper";
import { ConfigurationService } from "renderer/services/configuration.service";

export const DownloadMapsModal: ModalComponent<void, { version: BSVersion; ownedMaps: BsmLocalMap[] }> = ({ options: {data : { ownedMaps, version }} }) => {
    const beatSaver = useService(BeatSaverService);
    const config = useService(ConfigurationService);
    const mapsDownloader = useService(MapsDownloaderService);
    const progressBar = useService(ProgressBarService);

    const currentDownload = useObservable(() => mapsDownloader.currentMapDownload$);
    const mapsInQueue = useObservable(() => mapsDownloader.mapsInQueue$);
    const t = useTranslation();
    const filterContainerRef = useRef(null);
    const [filter, setFilter] = useState<MapFilter>({});
    const [query, setQuery] = useState("");
    const [maps, setMaps] = useState<BsvMapDetail[]>([]);
    const [downloadbleMaps, setDownloadbleMaps] = useState<DownloadableMap[]>([]);
    const [ownedMapHashs, setOwnedMapHashs] = useState<string[]>(ownedMaps?.map(map => map.hash) ?? []);
    const [loading, setLoading] = useState(false);
    const [searchParams, setSearchParams] = useState<SearchParams>({
        sortOrder: config.get("map-sort-order"),
        filter,
        page: 0,
        q: query,
    });

    const sortOptions: BsmSelectOption<BsvSearchOrder>[] = useConstant(() => {
        return Object.values(BsvSearchOrder).map(sort => ({ text: `beat-saver.maps-sorts.${sort}`, value: sort }));
    });

    useEffect(() => {
        setDownloadbleMaps(() => maps.map(map => {
            const isMapOwned = map.versions.some(version => ownedMapHashs.includes(version.hash));
            const isDownloading = map.id === currentDownload?.map?.id;
            const inQueue = mapsInQueue.some(toDownload => equal(toDownload.version, version) && toDownload.map.id === map.id);

            return { map, isOwned: isMapOwned, idDownloading: isDownloading, isInQueue: inQueue };
        }));
    }, [maps, currentDownload, mapsInQueue, ownedMapHashs])

    useEffect(() => {
        loadMaps(searchParams);
    }, [searchParams]);

    useEffect(() => {

        const sub = mapsDownloader.lastDownloadedMap$.subscribe({ next: ({ map, version: targetVersion }) => {
            if (!equal(targetVersion, version)) {
                return;
            }
            const downloadedHash = map.hash;
            setOwnedMapHashs(prev => [...prev, downloadedHash]);
        }});

        if (mapsDownloader.isDownloading) {
            progressBar.setStyle(mapsDownloader.progressBarStyle);
        }

        return () => {
            sub.unsubscribe();
            progressBar.setStyle(null);
        };
    }, []);

    const applyInstalledFilter = (maps: BsvMapDetail[]): BsvMapDetail[] => {
        return maps.filter(map => {
            if (!filter.installed) {
                return true;
            }

            return !map.versions.some(version => ownedMapHashs.includes(version.hash));
        });
    }

    const loadMaps = (params: SearchParams, tryToLoad = 5) => {
        setLoading(() => true);

        const searchResult = beatSaver.searchMaps(params);

        if (!filter.installed) {
            searchResult
                .then(maps => setMaps(prev => [...prev, ...maps]))
                .finally(() => setLoading(() => false));

            return;
        }

        searchResult
           .then(maps => {
                if (!maps.length) {
                    setLoading(() => false);

                    return;
                }

                maps = applyInstalledFilter(maps);
                setMaps(prev => [...prev, ...maps])

                if (maps.length < tryToLoad) {
                    handleLoadMore(false);

                    return;
                }

                setLoading(() => false);
            })
    };

    const renderMap = useCallback((downloadableMap: DownloadableMap) => {
        const { map } = downloadableMap;

        const downloadable = !downloadableMap.isOwned && !downloadableMap.isInQueue;
        const cancelable = downloadableMap.isInQueue && !downloadableMap.idDownloading;

        return <MapItem
            autor={map.metadata.levelAuthorName}
            autorId={map.uploader.id}
            bpm={map.metadata.bpm}
            coverUrl={map.versions.at(0).coverURL}
            createdAt={map.createdAt && toCalendarDateTime(parseAbsolute(map.createdAt, getLocalTimeZone()))}
            duration={map.metadata.duration}
            hash={map.versions.at(0).hash}
            likes={map.stats.upvotes}
            mapId={map.id}
            ranked={map.ranked}
            blRanked={map.blRanked}
            title={map.name}
            songAutor={map.metadata.songAuthorName}
            diffs={MapItemComponentPropsMapper.extractMapDiffs({ bsvMap: map })}
            songUrl={map.versions.at(0).previewURL}
            key={map.id}
            onDownload={downloadable && handleDownloadMap}
            onDoubleClick={downloadable && handleDownloadMap}
            onCancelDownload={cancelable && handleCancelDownload}
            downloading={downloadableMap.idDownloading}
            showOwned={downloadableMap.isOwned}
            callBackParam={map} />;
    }, [version]);

    const handleDownloadMap = useCallback((map: BsvMapDetail) => {
        mapsDownloader.addMapToDownload({ map, version });
    }, []);

    const handleCancelDownload = useCallback((map: BsvMapDetail) => {
        mapsDownloader.removeMapToDownload({ map, version });
    }, []);

    const handleSortChange = (newSort: BsvSearchOrder) => {
        config.set("map-sort-order", newSort);
        setMaps(() => []);
        setSearchParams(() => ({ ...searchParams, sortOrder: newSort }));
    };

    const handleSearch = () => {
        const searchParamsLocal: SearchParams = {
            sortOrder: searchParams.sortOrder,
            filter,
            q: query.trim(),
            page: 0,
        };

        setMaps(() => []);
        setSearchParams(() => searchParamsLocal);
    };

    const handleLoadMore = (skipLoading: boolean = true) => {

        if(skipLoading && loading){ return; }

        setSearchParams(prev => {
            return { ...prev, page: prev.page + 1 };
        });
    };

    return (
        <form
            className="text-gray-800 dark:text-gray-200 flex flex-col max-w-[95vw] w-[970px] h-[85vh] gap-3"
            onSubmit={e => {
                e.preventDefault();
                handleSearch();
            }}
        >
            <div className="flex h-9 gap-2 shrink-0">
                <BsmDropdownButton ref={filterContainerRef} className="shrink-0 h-full relative z-[1] flex justify-start" buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1 !bg-light-main-color-1 dark:!bg-main-color-1" icon="filter" text="pages.version-viewer.maps.search-bar.filters-btn" textClassName="whitespace-nowrap" withBar={false}>
                    <FilterPanel className="absolute top-[calc(100%+3px)] origin-top w-[450px] h-fit p-2 rounded-md shadow-md shadow-black" localData={false} filter={filter} onChange={setFilter} onApply={handleSearch} onClose={() => filterContainerRef.current.close()} />
                </BsmDropdownButton>
                <input className="h-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2 grow pb-0.5" type="text" placeholder={t("pages.version-viewer.maps.search-bar.search-placeholder")} value={query} onChange={e => setQuery(e.target.value)} />
                <BsmButton
                    className="shrink-0 rounded-full py-1 px-3 !bg-light-main-color-1 dark:!bg-main-color-1 flex justify-center items-center capitalize"
                    icon="search"
                    text="modals.download-maps.search-btn"
                    textClassName="whitespace-nowrap"
                    withBar={false}
                    onClick={e => {
                        e.preventDefault();
                        handleSearch();
                    }}
                />
                <BsmSelect className="bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-1 pb-0.5 text-center w-min" options={sortOptions} selected={searchParams.sortOrder} onChange={sort => handleSortChange(sort)} />
            </div>

            {(() => {
                if(downloadbleMaps?.length) {
                    return (
                        <VirtualScroll
                            classNames={{
                                mainDiv: "size-full",
                                rows: "gap-x-2 px-2 py-2"
                            }}
                            minColumns={1}
                            maxColumns={2}
                            itemHeight={108}
                            minItemWidth={400}
                            items={downloadbleMaps}
                            rowKey={mapsInRow => mapsInRow.map(map => map.map.id).join("-")}
                            renderItem={renderMap}
                            scrollEnd={{
                                onScrollEnd: handleLoadMore,
                                margin: 100
                            }}

                        />
                    )
                }

                return (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <img className={`w-32 h-32 ${loading && "spin-loading"}`} src={loading ? BeatWaitingImg : BeatConflictImg} alt=" " />
                        <span className="text-lg">
                            {(() => {
                                if (loading) {
                                    return t("modals.download-maps.loading-maps");
                                }
                                return t("modals.download-maps.no-maps-found");
                            })()}
                        </span>
                    </div>
                )

            })()}

        </form>
    );
};

type DownloadableMap = {
    map: BsvMapDetail;
    isOwned: boolean;
    idDownloading: boolean;
    isInQueue: boolean;
};
