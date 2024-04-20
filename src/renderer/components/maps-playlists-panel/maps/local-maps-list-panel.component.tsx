import { MapsManagerService } from "renderer/services/maps-manager.service";
import { BSVersion } from "shared/bs-version.interface";
import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { Subscription, BehaviorSubject } from "rxjs";
import { MapFilter, MapTag } from "shared/models/maps/beat-saver.model";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import { VariableSizeList } from "react-window";
import { MapsRow } from "./maps-row.component";
import { debounceTime, last, tap } from "rxjs/operators";
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

type Props = {
    version: BSVersion;
    className?: string;
    filter?: MapFilter;
    search?: string;
    linkedState?: FolderLinkState;
    isActive?: boolean;
};

export const LocalMapsListPanel = forwardRef<unknown, Props>(({ version, className, filter, search, linkedState, isActive }, forwardRef) => {
    const mapsManager = useService(MapsManagerService);
    const mapsDownloader = useService(MapsDownloaderService);

    const t = useTranslation();

    const ref = useRef(null);

    const {maps$, setMaps} = useContext(InstalledMapsContext);
    const maps = useObservable(() => maps$, undefined);
    const [subs] = useState<Subscription[]>([]);
    const [selectedMaps$] = useState(new BehaviorSubject<BsmLocalMap[]>([]));
    const [itemPerRow, setItemPerRow] = useState(2);
    const [listHeight, setListHeight] = useState(0);
    const isActiveOnce = useChangeUntilEqual(isActive, { untilEqual: true });
    const [linked, setLinked] = useState(false);

    const loadPercent$ = useConstant(() => new BehaviorSubject(0));

    useImperativeHandle(
        forwardRef,
        () => ({
            deleteMaps() {
                const mapsToDelete = selectedMaps$.value.length === 0 ? maps : selectedMaps$.value;
                mapsManager.deleteMaps(mapsToDelete, version).then(res => {
                    if (!res) {
                        return;
                    }
                    removeMapsFromList(mapsToDelete);
                    selectedMaps$.next([]);
                });
            },
            exportMaps() {
                mapsManager.exportMaps(version, selectedMaps$.value);
            }
        }),
        [selectedMaps$.value, maps, version]
    );

    useOnUpdate(() => {
        if(linkedState === FolderLinkState.Pending || linkedState === FolderLinkState.Processing) return () => {};
        setLinked(linkedState === FolderLinkState.Linked);
    }, [linkedState]);

    useEffect(() => {
        if (isActiveOnce) {
            loadMaps();
        }

        return () => {
            setMaps(null);
            loadPercent$.next(0);
            subs.forEach(s => s.unsubscribe());
            mapsDownloader.removeOnMapDownloadedListener(loadMaps);
        };
    }, [isActiveOnce, version, linked]);

    useEffect(() => {
        if(isActiveOnce){
            mapsDownloader.addOnMapDownloadedListener((map, targetVersion) => {
                if (!equal(targetVersion, version)) {
                    return;
                }
                setMaps((maps ? [map, ...maps] : [map]));
            });
        }

        return () => {
            mapsDownloader.removeOnMapDownloadedListener(loadMaps);
        }

    }, [isActiveOnce, version, maps])

    useEffect(() => {
        if (!isActiveOnce) {
            return;
        }

        const updateItemPerRow = (listWidth: number) => {
            const newPerRow = Math.min(Math.floor(listWidth / 400), 3);
            if (newPerRow === itemPerRow) {
                return;
            }
            setItemPerRow(newPerRow);
        };

        const heightObserver$ = new BehaviorSubject(0);

        const observer = new ResizeObserver(() => {
            updateItemPerRow(ref.current?.clientWidth || 0);
            heightObserver$.next(ref.current?.clientHeight || 0);
        });

        observer.observe(ref.current);

        const sub = heightObserver$.pipe(debounceTime(100)).subscribe(setListHeight);

        return () => {
            observer.disconnect();
            sub.unsubscribe();
        };
    }, [isActiveOnce, itemPerRow]);

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
        const filtredMaps = maps.filter(map => !mapsToRemove.some(toDeleteMaps => map.hash === toDeleteMaps.hash));
        setMaps(filtredMaps);

        const filtredSelectedMaps = selectedMaps$.value.filter(map => !mapsToRemove.some(toDeleteMaps => map.hash === toDeleteMaps.hash));
        selectedMaps$.next(filtredSelectedMaps);
    };

    const handleDelete = useCallback(
        (map: BsmLocalMap) => {
            mapsManager.deleteMaps([map], version).then(res => {
                if (!res) {
                    return;
                }
                removeMapsFromList([map]);
            });
        },
        [version, maps]
    );

    const onMapSelected = useCallback(
        (map: BsmLocalMap) => {
            const mapsCopy = [...selectedMaps$.value];
            if (mapsCopy.some(selectedMap => selectedMap.hash === map.hash)) {
                const i = mapsCopy.findIndex(selectedMap => selectedMap.hash === map.hash);
                mapsCopy.splice(i, 1);
            } else {
                mapsCopy.push(map);
            }

            selectedMaps$.next(mapsCopy);
        },
        [selectedMaps$.value]
    );

    const isMapFitFilter = (map: BsmLocalMap): boolean => {
        // Can be more clean and optimized i think

        const fitEnabledTags = (() => {

            if (!filter?.enabledTags || filter.enabledTags.size === 0) {
                return true;
            }
            if (!map?.songDetails?.tags) {
                return false;
            }
            return Array.from(filter.enabledTags.values()).every(tag => map.songDetails.tags.some(mapTag => mapTag === tag));
        })();

        if (!fitEnabledTags) {
            return false;
        }

        const fitExcluedTags = (() => {
            if (!filter?.excludedTags || filter.excludedTags.size === 0) {
                return true;
            }
            if (!map?.songDetails?.tags) {
                return true;
            }
            return !map.songDetails?.tags.some(tag => filter.excludedTags.has(tag as MapTag));
        })();

        if (!fitExcluedTags) {
            return false;
        }

        const fitMinNps = (() => {
            if (!filter?.minNps) {
                return true;
            }

            return map.songDetails?.difficulties.some(diff => diff.nps > filter.minNps);
        })();

        if (!fitMinNps) {
            return false;
        }

        const fitMaxNps = (() => {
            if (!filter?.maxNps) {
                return true;
            }

            return  map.songDetails?.difficulties.some(diff => diff.nps < filter.maxNps);
        })();

        if (!fitMaxNps) {
            return false;
        }

        const fitMinDuration = (() => {
            if (!filter?.minDuration) {
                return true;
            }

            if (!map?.songDetails?.duration) {
                return false;
            }
            return map.songDetails?.duration >= filter.minDuration;
        })();

        if (!fitMinDuration) {
            return false;
        }

        const fitMaxDuration = (() => {
            if (!filter?.maxDuration) {
                return true;
            }
            if (!map?.songDetails?.duration) {
                return false;
            }
            return map.songDetails?.duration <= filter.maxDuration;
        })();

        if (!fitMaxDuration) {
            return false;
        }

        const fitNoodle = (() => {
            if (!filter?.noodle) {
                return true;
            }
            return map.songDetails?.difficulties.some(diff => !!diff.ne);
        })();

        if (!fitNoodle) {
            return false;
        }

        const fitMe = (() => {
            if (!filter?.me) {
                return true;
            }

            return map.songDetails?.difficulties.some(diff => !!diff.me);
        })();

        if (!fitMe) {
            return false;
        }

        const fitCinema = (() => {
            if (!filter?.cinema) {
                return true;
            }

            return map.songDetails?.difficulties.some(diff => !!diff.cinema);
        })();

        if (!fitCinema) {
            return false;
        }

        const fitChroma = (() => {
            if (!filter?.chroma) {
                return true;
            }

            return map.songDetails?.difficulties.some(diff => !!diff.chroma);
        })();

        if (!fitChroma) {
            return false;
        }

        const fitFullSpread = (() => {
            if (!filter?.fullSpread) {
                return true;
            }

            return map.songDetails?.difficulties.length >= 5;
        })();

        if (!fitFullSpread) {
            return false;
        }

        if (filter?.automapper && (map.songDetails && !map.songDetails?.automapper)) {
            return false;
        }
        if (!(filter?.ranked ? map.songDetails?.ranked === filter.ranked : true)) {
            return false;
        }
        if (!(filter?.curated ? !!map.songDetails?.curated === filter.curated : true)) {
            return false;
        }
        if (!(filter?.verified ? !!map.songDetails?.uploader?.verified : true)) {
            return false;
        }

        const searchCheck = (() => {
            return (map.rawInfo?._songName || "")?.toLowerCase().includes(search.toLowerCase()) || (map.rawInfo?._songAuthorName || "")?.toLowerCase().includes(search.toLowerCase()) || (map.rawInfo?._levelAuthorName  || "")?.toLowerCase().includes(search.toLowerCase());
        })();

        if (!searchCheck) {
            return false;
        }

        return true;
    };

    const preppedMaps: BsmLocalMap[][] = (() => {
        if (!maps) {
            return [];
        }

        const res: BsmLocalMap[][] = [];
        let mapsRow: BsmLocalMap[] = [];

        for (const map of maps) {
            if (!isMapFitFilter(map)) {
                continue;
            }
            if (mapsRow.length === itemPerRow) {
                res.push(mapsRow);
                mapsRow = [];
            }
            mapsRow.push(map);
        }

        if (mapsRow.length) {
            res.push(mapsRow);
        }

        return res;
    })();

    if (!maps) {
        return (
            <div ref={ref} className={className}>
                <BsContentLoader className="h-full flex flex-col items-center justify-center flex-wrap gap-1 text-gray-800 dark:text-gray-200" value$={loadPercent$} text="modals.download-maps.loading-maps" />
            </div>
        );
    }

    if (!maps.length) {
        return (
            <div ref={ref} className={className}>
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
        <div ref={ref} className={className}>
            <VariableSizeList className="scrollbar-default" width="100%" height={listHeight} itemSize={() => 108} itemCount={preppedMaps.length} itemData={preppedMaps} layout="vertical" style={{ scrollbarGutter: "stable both-edges" }} itemKey={(i, data) => data[i].map(map => map.hash).join()}>
                {props => <MapsRow maps={props.data[props.index]} style={props.style} selectedMaps$={selectedMaps$} onMapSelect={onMapSelected} onMapDelete={handleDelete} />}
            </VariableSizeList>
        </div>
    );
});
