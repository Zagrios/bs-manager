import { MapsManagerService } from "renderer/services/maps-manager.service";
import { BSVersion } from "shared/bs-version.interface";
import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useState } from "react";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { Subscription, BehaviorSubject, lastValueFrom } from "rxjs";
import { MapFilter, MapSort } from "shared/models/maps/beat-saver.model";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import { bufferTime, last, tap } from "rxjs/operators";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";
import { BsmImage } from "../../shared/bsm-image.component";
import { BsmButton } from "../../shared/bsm-button.component";
import { useChangeUntilEqual } from "renderer/hooks/use-change-until-equal.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { BsContentLoader } from "renderer/components/shared/bs-content-loader.component";
import { InstalledMapsContext } from "../maps-playlists-panel.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import equal from "fast-deep-equal";
import { VirtualScroll } from "renderer/components/shared/virtual-scroll/virtual-scroll.component";
import { MapItem } from "./map-item.component";
import { isLocalMapFitMapFilter } from "./filter-panel.component";
import { MapItemComponentPropsMapper } from "shared/mappers/map/map-item-component-props.mapper";
import { noop } from "shared/helpers/function.helpers";

type Props = {
    version: BSVersion;
    className?: string;
    filter?: MapFilter;
    search?: string;
    linkedState?: FolderLinkState;
    isActive?: boolean;
    sort: MapSort;
};

export type LocalMapsListPanelRef = {
    deleteMaps: () => void;
    exportMaps: () => void;
    removeDuplicates: () => void;
}

export const LocalMapsListPanel = forwardRef<unknown, Props>(({
    version,
    className,
    filter,
    search,
    linkedState,
    isActive,
    sort,
}, forwardRef) => {
    const mapsManager = useService(MapsManagerService);
    const mapsDownloader = useService(MapsDownloaderService);

    const t = useTranslation();

    const {maps$, setMaps} = useContext(InstalledMapsContext);
    const maps = useObservable(() => maps$);
    const [renderableMaps, setRenderableMaps] = useState<RenderableMap[]>([]);
    const [subs] = useState<Subscription[]>([]);
    const [selectedMaps, setSelectedMaps] = useState<BsmLocalMap[]>([]);
    const isActiveOnce = useChangeUntilEqual(isActive, { untilEqual: true });
    const [linked, setLinked] = useState(false);

    const loadPercent$ = useConstant(() => new BehaviorSubject(0));

    useImperativeHandle(forwardRef, () => ({
        deleteMaps() {
            const mapsToDelete = selectedMaps.length === 0 ? maps : selectedMaps;
            mapsManager.deleteMaps(mapsToDelete, version).then(res => {
                if (!res) {
                    return;
                }
                removeMapsFromList(mapsToDelete);
                setSelectedMaps([]);
            });
        },
        exportMaps() {
            mapsManager.exportMaps(version, selectedMaps);
        },
        removeDuplicates() {
            return lastValueFrom(mapsManager.deleteDuplicateMaps(maps$.value)).then(res => {
                if(!res?.current){ return; }
                loadMaps();
            }).catch(noop);
        }
    }),[selectedMaps, maps, version]);

    useOnUpdate(() => {
        setRenderableMaps(() => maps?.map(map => ({ map, selected: selectedMaps.some(selectedMap => selectedMap.hash === map.hash) }) ));
    }, [maps, selectedMaps]);

    useOnUpdate(() => {
        if(linkedState === FolderLinkState.Pending || linkedState === FolderLinkState.Processing) return noop;
        setLinked(linkedState === FolderLinkState.Linked);
        return noop;
    }, [linkedState]);

    useOnUpdate(() => setSelectedMaps([]), [version]); // Clear selected maps when version changes

    useEffect(() => {
        if (isActiveOnce) {
            loadMaps();
        }

        return () => {
            setMaps(null);
            loadPercent$.next(0);
            subs.forEach(s => s.unsubscribe());
        };
    }, [isActiveOnce, version, linked]);

    useEffect(() => {

        const subs: Subscription[] = [];

        if(isActiveOnce){
            subs.push(mapsDownloader.lastDownloadedMap$.subscribe({ next: ({map, version: targetVersion}) => {
                if (!equal(targetVersion, version)) {
                    return;
                }
                setMaps((maps$.value ? [map, ...maps$.value] : [map]));
            }}));

            subs.push(mapsManager.$onMapImported(version).pipe(bufferTime(500)).subscribe({ next: newMaps => {
                const maps = (maps$.value ?? []).filter(map => !newMaps.some(newMap => newMap.path === map.path));
                setMaps([...newMaps, ...maps]);
            }}));
        }

        return () => {
            subs.forEach(s => s.unsubscribe());
        }

    }, [isActiveOnce, version])

    const loadMaps = () => {
        setMaps(null);
        loadPercent$.next(0);

        const loadMapsObs$ = mapsManager.getMaps(version);

        subs.push(
            loadMapsObs$
                .pipe(
                    tap(progress => loadPercent$.next(Math.floor((progress.loaded / progress.total) * 100))),
                    last()
                )
                .subscribe({
                    next: progress => setMaps(progress.maps),
                    complete: () => loadPercent$.next(0),
                })
        );
    };

    const removeMapsFromList = (mapsToRemove: BsmLocalMap[]) => {
        const filtredMaps = maps$.value.filter(map => !mapsToRemove.some(toDeleteMaps => map.hash === toDeleteMaps.hash));
        setMaps(filtredMaps);

        setSelectedMaps(selectedMaps => selectedMaps.filter(map => !mapsToRemove.some(toDeleteMaps => map.hash === toDeleteMaps.hash)));
    };

    const handleDelete = (map: BsmLocalMap) => {
        mapsManager.deleteMaps([map], version).then(res => {
            if (!res) {
                return;
            }
            removeMapsFromList([map]);
        });
    }

    const onMapSelected = (map: BsmLocalMap) => {

        setSelectedMaps(selectedMaps => {
            const mapsCopy = [...selectedMaps];
            if (mapsCopy.some(selectedMap => selectedMap.hash === map.hash)) {
                const i = mapsCopy.findIndex(selectedMap => selectedMap.hash === map.hash);
                mapsCopy.splice(i, 1);
            } else {
                mapsCopy.push(map);
            }
            return mapsCopy;
        });
    }

    const renderMap = useCallback((renderableMap: RenderableMap) => {
        const { map } = renderableMap;
        return (
            <MapItem
                key={map.path}
                hash={map.hash}
                title={map.mapInfo.songName}
                coverUrl={map.coverUrl}
                songUrl={map.songUrl}
                autor={map.mapInfo.levelMappers.at(0)}
                songAutor={map.mapInfo.songAuthorName}
                bpm={map.mapInfo.beatsPerMinute}
                duration={map.songDetails?.duration}
                selected={renderableMap.selected}
                diffs={MapItemComponentPropsMapper.extractMapDiffs({ mapInfo: map.mapInfo, songDetails: map.songDetails })}
                mapId={map.songDetails?.id}
                ranked={map.songDetails?.ranked}
                blRanked={map.songDetails?.blRanked}
                autorId={map.songDetails?.uploader.id}
                likes={map.songDetails?.upVotes}
                createdAt={map.songDetails?.uploadedAt}
                onDelete={handleDelete}
                onSelected={onMapSelected}
                callBackParam={map}
            />
        );
    }, [version]);

    const preppedMaps: RenderableMap[] = (() => {
        return (renderableMaps?.filter(renderableMap => isLocalMapFitMapFilter({ map: renderableMap.map, filter, search })) ?? [])
        // NOTE: might be good to cache sorted maps, to reduce loading
            .sort((map1, map2) => sort.compare(map1.map, map2.map) * (sort.ascending === false ? -1 : 1));
    })();

    if (!maps) {
        return (
            <div className={className}>
                <BsContentLoader className="h-full flex flex-col items-center justify-center flex-wrap gap-1 text-gray-800 dark:text-gray-200" value$={loadPercent$} text="modals.download-maps.loading-maps" />
            </div>
        );
    }

    if (!maps.length) {
        return (
            <div className={className}>
                <div className="h-full flex flex-col items-center justify-center flex-wrap gap-1 text-gray-800 dark:text-gray-200">
                    <BsmImage className="h-32" image={BeatConflict} />
                    <span className="font-bold">{t("pages.version-viewer.maps.tabs.maps.empty-maps.text")}</span>
                    <BsmButton
                        className="font-bold rounded-md p-2"
                        text="pages.version-viewer.maps.tabs.maps.empty-maps.button"
                        typeColor="primary"
                        withBar={false}
                        onClick={e => {
                            e.preventDefault();
                            mapsDownloader.openDownloadMapModal(version);
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
            <VirtualScroll
                classNames={{ mainDiv: className, rows: "gap-x-2 px-2 pt-2 pb-[108px]" }}
                itemHeight={108}
                maxColumns={3}
                minItemWidth={400}
                items={preppedMaps}
                rowKey={rowMaps => rowMaps.map(map => map.map.hash).join("")}
                renderItem={renderMap}/>
    );
});

type RenderableMap = {
    map: BsmLocalMap;
    selected: boolean;
};
