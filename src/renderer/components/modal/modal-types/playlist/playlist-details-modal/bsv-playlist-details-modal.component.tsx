import { BsvMapDetail, BsvPlaylist } from "shared/models/maps/beat-saver.model";
import { PlaylistDetailsTemplate } from "./playlist-details-template.component";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { Observable } from "rxjs";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { useCallback, useEffect, useState } from "react";
import { MapItem } from "renderer/components/maps-playlists-panel/maps/map-item.component";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service";
import { getLocalTimeZone, parseAbsolute, toCalendarDateTime } from "@internationalized/date";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import equal from "fast-deep-equal";
import BeatWaiting from "../../../../../../../assets/images/apngs/beat-waiting.png"
import BeatConflict from "../../../../../../../assets/images/apngs/beat-conflict.png"
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { cn } from "renderer/helpers/css-class.helpers";
import { VirtualScroll } from "renderer/components/shared/virtual-scroll/virtual-scroll.component";
import { MapItemComponentPropsMapper } from "shared/mappers/map/map-item-component-props.mapper";
import { useTranslation } from "renderer/hooks/use-translation.hook";

type Props = {
    version: BSVersion;
    playlist: BsvPlaylist;
    installedMaps$: Observable<BsmLocalMap[]>;
}

export const BsvPlaylistDetailsModal: ModalComponent<void, Props> = ({ resolver, options: { data: { playlist, installedMaps$, version } } }) => {

    const t = useTranslation();

    const beatsaver = useService(BeatSaverService);
    const mapsDownloader = useService(MapsDownloaderService);

    const currentMapDownload = useObservable(() => mapsDownloader.currentMapDownload$, null);
    const downloadingMaps = useObservable(() => mapsDownloader.mapsInQueue$, []);
    const installedMaps = useObservable(() => installedMaps$, null);
    const [page, setPage] = useState(0);
    const [playlistMaps, setPlaylistMaps] = useState<BsvMapDetail[]>(null);
    const [downloadbleMaps, setDownloadbleMaps] = useState<DownloadableMap[]>([]);
    const [error, setError] = useState<boolean>(false);

    useOnUpdate(() => {
        beatsaver.getPlaylistDetailsById(`${playlist.playlistId}`, page)
            .then(playlistDetails => setPlaylistMaps(prev => [...(prev ?? []), ...(playlistDetails?.maps?.map(map => map.map) ?? [])]))
            .catch(() => setError(() => true));
    }, [page]);


    useEffect(() => {
        const ownedMapHashs = installedMaps?.map(map => map.hash) ?? [];

        if(!Array.isArray(playlistMaps)){
            return setDownloadbleMaps([]);
        }

        setDownloadbleMaps(() => playlistMaps.map(map => {
            const isMapOwned = map.versions.some(version => ownedMapHashs.includes(version.hash));
            const isDownloading = map.id === currentMapDownload?.map?.id;
            const inQueue = downloadingMaps.some(toDownload => equal(toDownload.version, version) && toDownload.map.id === map.id);

            return { map, isOwned: isMapOwned, idDownloading: isDownloading, isInQueue: inQueue };
        }));
    }, [playlistMaps, currentMapDownload, downloadingMaps, installedMaps])

    const renderMapItem = useCallback((downloadableMap: DownloadableMap) => {
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
            mapId={map.id} ranked={map.ranked}
            title={map.name}
            songAutor={map.metadata.songAuthorName}
            diffs={MapItemComponentPropsMapper.extractMapDiffs({ bsvMap: map })}
            songUrl={map.versions.at(0).previewURL}
            key={map.id}
            onDownload={downloadable && (() => mapsDownloader.addMapToDownload({version, map}))}
            onCancelDownload={cancelable && (() => mapsDownloader.removeMapToDownload({version, map}))}
            downloading={downloadableMap.idDownloading}
            callBackParam={map} />;
    }, [version]);

    return (
        <PlaylistDetailsTemplate
            title={playlist.name}
            author={playlist.owner.name}
            description={playlist.description}
            duration={playlist.stats?.totalDuration}
            imageUrl={playlist.playlistImage}
            maxNps={playlist.stats?.maxNps}
            minNps={playlist.stats?.minNps}
            nbMappers={playlist.stats?.mapperCount}
            nbMaps={playlist.stats?.totalMaps}
            onClose={() => resolver({ exitCode: ModalExitCode.CLOSED })}
        >
            {(() => {

                if(!Array.isArray(playlistMaps)) {
                    return (
                        <div className="w-full flex flex-col justify-center items-center mt-10">
                            <BsmImage className={cn(["size-32", !error && "spin-loading"])} image={error ? BeatConflict : BeatWaiting} />
                            <p className="text-lg font-bold px-10 text-center">
                                {error ? t("playlist.error-occur-while-loading-playlist") : t("playlist.loading-maps")}
                            </p>
                        </div>
                    );
                }

                if(playlistMaps.length === 0) {
                    return (
                        <div className="w-full flex flex-col justify-center items-center mt-10">
                            <BsmImage className="size-32" image={BeatConflict} />
                            <p className="text-lg font-bold px-10 text-center">
                                {t("playlist.no-maps-found-for-playlist")}
                            </p>
                        </div>
                    );
                }

                return (
                    <VirtualScroll
                        maxColumns={1}
                        minItemWidth={300}
                        itemHeight={110}
                        items={downloadbleMaps}
                        renderItem={renderMapItem}
                        classNames={{
                            mainDiv: "min-h-0 w-full grow",
                            rows: "my-2.5 px-2.5"
                        }}
                        scrollEnd={{
                            onScrollEnd: () => setPage(prev => prev + 1),
                            margin: 100
                        }}
                    />
                )
            })()}
        </PlaylistDetailsTemplate>
    )
}

type DownloadableMap = {
    map: BsvMapDetail;
    isOwned: boolean;
    idDownloading: boolean;
    isInQueue: boolean;
};
