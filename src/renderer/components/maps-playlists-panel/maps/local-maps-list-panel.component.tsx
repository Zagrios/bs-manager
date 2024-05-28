import { MapsManagerService } from "renderer/services/maps-manager.service";
import { BSVersion } from "shared/bs-version.interface";
import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useState } from "react";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { Subscription, BehaviorSubject } from "rxjs";
import { MapFilter, MapTag } from "shared/models/maps/beat-saver.model";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import { last, tap } from "rxjs/operators";
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
import { MapItem, extractMapDiffs } from "./map-item.component";

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

    const {maps$, setMaps} = useContext(InstalledMapsContext);
    const maps = useObservable(() => maps$, undefined);
    const [subs] = useState<Subscription[]>([]);
    const [selectedMaps, setSelectedMaps] = useState<BsmLocalMap[]>([]);
    const isActiveOnce = useChangeUntilEqual(isActive, { untilEqual: true });
    const [linked, setLinked] = useState(false);

    const loadPercent$ = useConstant(() => new BehaviorSubject(0));

    useImperativeHandle(
        forwardRef,
        () => ({
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
            }
        }),
        [selectedMaps, maps, version]
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

        const filtredSelectedMaps = selectedMaps.filter(map => !mapsToRemove.some(toDeleteMaps => map.hash === toDeleteMaps.hash));
        setSelectedMaps(filtredSelectedMaps);
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
            const mapsCopy = [...selectedMaps];
            if (mapsCopy.some(selectedMap => selectedMap.hash === map.hash)) {
                const i = mapsCopy.findIndex(selectedMap => selectedMap.hash === map.hash);
                mapsCopy.splice(i, 1);
            } else {
                mapsCopy.push(map);
            }

            setSelectedMaps(mapsCopy)
        },
        [selectedMaps]
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

    const preppedMaps: BsmLocalMap[] = (() => {
        if (!maps) {
            return [];
        }

        return maps.filter(isMapFitFilter);
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
                classNames={{ mainDiv: className, rows: "gap-x-2 px-2 py-2" }}
                itemHeight={108}
                maxColumns={3}
                minItemWidth={400}
                items={preppedMaps}
                renderItem={map => (
                    <MapItem
                        key={map.path}
                        hash={map.hash}
                        title={map.rawInfo._songName}
                        coverUrl={map.coverUrl}
                        songUrl={map.songUrl}
                        autor={map.rawInfo._levelAuthorName}
                        songAutor={map.rawInfo._songAuthorName}
                        bpm={map.rawInfo._beatsPerMinute}
                        duration={map.songDetails?.duration}
                        selected={selectedMaps.some(selectedMap => selectedMap.hash === map.hash)}
                        diffs={extractMapDiffs({ rawMapInfo: map.rawInfo, songDetails: map.songDetails })}
                        mapId={map.songDetails?.id}
                        ranked={map.songDetails?.ranked}
                        autorId={map.songDetails?.uploader.id}
                        likes={map.songDetails?.upVotes}
                        createdAt={map.songDetails?.uploadedAt}
                        onDelete={handleDelete}
                        onSelected={onMapSelected}
                        callBackParam={map}
                    />
                )}/>
    );
});