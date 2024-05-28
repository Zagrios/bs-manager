import { BsvMapDetail, BsvPlaylist } from "shared/models/maps/beat-saver.model";
import { PlaylistDetailsTemplate } from "./playlist-details-template.component";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { Observable } from "rxjs";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { useState } from "react";
import { MapItem, extractMapDiffs } from "renderer/components/maps-playlists-panel/maps/map-item.component";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service";
import { getLocalTimeZone, parseAbsolute, toCalendarDateTime } from "@internationalized/date";
import { motion } from "framer-motion";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import equal from "fast-deep-equal";
import BeatWaiting from "../../../../../../../assets/images/apngs/beat-waiting.png"
import BeatConflict from "../../../../../../../assets/images/apngs/beat-conflict.png"
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { cn } from "renderer/helpers/css-class.helpers";

type Props = {
    version: BSVersion;
    playlist: BsvPlaylist;
    installedMaps$: Observable<BsmLocalMap[]>;
}

// TODO : Translate

export const BsvPlaylistDetailsModal: ModalComponent<void, Props> = ({ resolver, options: { data: { playlist, installedMaps$, version } } }) => {

    const beatsaver = useService(BeatSaverService);
    const mapsDownloader = useService(MapsDownloaderService);

    const downloadingMaps = useObservable(() => mapsDownloader.mapsInQueue$, []);
    const installedMaps = useObservable(() => installedMaps$, null);
    const [page, setPage] = useState(0);
    const [playlistMaps, setPlaylistMaps] = useState<BsvMapDetail[]>(null);
    const [error, setError] = useState<boolean>(false);

    useOnUpdate(() => {
        beatsaver.getPlaylistDetailsById(`${playlist.playlistId}`, page)
            .then(playlistDetails => setPlaylistMaps(prev => [...(prev ?? []), ...(playlistDetails?.maps?.map(map => map.map) ?? [])]))
            .catch(() => setError(() => true));
    }, [page]);

    return (
        <PlaylistDetailsTemplate
            title={playlist.name}
            author={playlist.owner.name}
            description={playlist.description}
            duration={playlist.stats.totalDuration}
            imageUrl={playlist.playlistImage}
            maxNps={playlist.stats.maxNps}
            minNps={playlist.stats.minNps}
            nbMappers={playlist.stats.mapperCount}
            nbMaps={playlist.stats.totalMaps}
            onClose={() => resolver({ exitCode: ModalExitCode.CLOSED })}
        >
            {(() => {

                if(!Array.isArray(playlistMaps)) {
                    return (
                        <div className="w-full flex flex-col justify-center items-center mt-10">
                            <BsmImage className={cn(["size-32", !error && "spin-loading"])} image={error ? BeatConflict : BeatWaiting} />
                            <p className="text-lg font-bold px-10 text-center">
                                {error ? "Une erreur est survenue lors du chargement de la playlist" : "Chargement des maps..."}
                            </p>
                        </div>
                    );
                }

                if(playlistMaps.length === 0) {
                    return (
                        <div className="w-full flex flex-col justify-center items-center mt-10">
                            <BsmImage className="size-32" image={BeatConflict} />
                            <p className="text-lg font-bold px-10 text-center">
                                Aucune map trouvée pour cette playlist
                            </p>
                        </div>
                    );
                }

                return (
                    <ul className="min-h-0 w-full grow space-y-2 pl-2.5 pr-2 py-3 overflow-y-scroll overflow-x-hidden scrollbar-default">
                        {playlistMaps.map(map => {

                            const downloadingMap = downloadingMaps.at(0);
                            const isMapOwned = installedMaps?.some(installedMap => installedMap.hash === map.versions.at(0).hash);
                            const isMapInQueue = downloadingMaps.some(downloadingMap => downloadingMap.map.versions.at(0).hash === map.versions.at(0).hash);
                            const isMapDownloading = (isMapInQueue && downloadingMap) ? equal(downloadingMap.version, version) && downloadingMap.map.versions.at(0).hash === map.versions.at(0).hash : false;

                            return (
                                <MapItem
                                    key={map.id}
                                    title={map.name}
                                    autor={map.uploader.name}
                                    autorId={map.uploader.id}
                                    bpm={map.metadata.bpm}
                                    coverUrl={map.versions.at(0).coverURL}
                                    createdAt={map.createdAt && toCalendarDateTime(parseAbsolute(map.createdAt, getLocalTimeZone()))}
                                    duration={map.metadata.duration}
                                    hash={map.versions.at(0).hash}
                                    mapId={map.id}
                                    likes={map.stats.upvotes}
                                    ranked={map.ranked}
                                    songAutor={map.metadata.songAuthorName}
                                    songUrl={map.versions.at(0).previewURL}
                                    diffs={extractMapDiffs({ bsvMap: map })}
                                    downloading={isMapDownloading}
                                    onDownload={!isMapOwned && !isMapInQueue && (() => mapsDownloader.addMapToDownload({version, map}))}
                                    onCancelDownload={isMapInQueue && !isMapDownloading && (() => mapsDownloader.removeMapToDownload({version, map}))}
                                    callBackParam={map}
                                />);
                        })}
                        <motion.span className="w-full h-8" onViewportEnter={() => setPage(prev => prev + 1)} />
                    </ul>
                )
            })()}
        </PlaylistDetailsTemplate>
    )
}
