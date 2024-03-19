import { ModalComponent } from "renderer/services/modale.service"
import { PlaylistDetailsTemplate, PlaylistDetailsTemplateProps } from "./playlist-details-template.component"
import { Observable, first, lastValueFrom, map, shareReplay, switchMap, take, tap } from "rxjs"
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { BSVersion } from "shared/bs-version.interface";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { MapItem } from "renderer/components/maps-playlists-panel/maps/map-item.component";
import { extractMapDiffs } from "renderer/components/maps-playlists-panel/maps/maps-row.component";
import { useService } from "renderer/hooks/use-service.hook";
import { AudioPlayerService } from "renderer/services/audio-player.service";
import { AnimatePresence, motion } from "framer-motion";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import BeatConflict from "../../../../../../assets/images/apngs/beat-conflict.png";
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { PlaylistDownloaderService } from "renderer/services/playlist-downloader.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";

interface Props {
    version: BSVersion;
    localPlaylist$: Observable<LocalBPListsDetails>;
    installedMaps$: Observable<BsmLocalMap[]>;
}

export const LocalPlaylistDetailsModal: ModalComponent<void, Props> = ({resolver, options}) => {

    const audioPlayer = useService(AudioPlayerService);
    const playlistDownloader = useService(PlaylistDownloaderService);
    const progressBar = useService(ProgressBarService);

    const localPlaylist = useObservable(() => options.data.localPlaylist$, null);
    const installedMaps = useObservable(() => options.data.installedMaps$, null);

    const playPlaylist = () => {
        if (!installedMaps) {
            return;
        }
        audioPlayer.play(installedMaps.map(map => ({ src: map.songUrl, bpm: map.rawInfo?._beatsPerMinute ?? 0})));
    };

    const installPlaylist = () => {
        const obs$ = playlistDownloader.installPlaylist(localPlaylist, options.data.version);

        const progress$ = obs$.pipe(
            map(progress => (progress.current / progress.total) * 100),
        );

        const obsWithProgress$ = obs$.pipe(
            take(1),
            tap(() => progressBar.show(progress$, true)),
            switchMap(() => obs$),
            tap({ complete: () => progressBar.hide(true) })
        );

        return lastValueFrom(obsWithProgress$);
    }

    const renderMaps = () => {
        if (!installedMaps) {
            // loading maps
            return null;
        }

        if(installedMaps.length === 0) {
            // no maps
            return null;
        }

        return (
            <div className="grow min-h-0 overflow-hidden flex flex-col justify-start items-center">
                <AnimatePresence>
                    {/* If nb installed maps not correspond to nb maps of the playlist */}
                    {installedMaps.length !== localPlaylist.nbMaps && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "7rem" }}
                            exit={{ height: 0 }}
                            transition={{delay: .25, duration: .25}}
                            className="shrink-0 w-full text-center overflow-hidden flex justify-center items-center"
                        >
                            <div className="size-[calc(100%-1rem)] bg-main-color-2 rounded-md translate-y-1.5 flex flex-row justify-center items-center gap-3">
                                <BsmImage image={BeatConflict} className="size-24"/>
                                <div className="text-white font-bold w-fit space-y-1.5 flex flex-col justify-center items-center">
                                    <p>Certaines maps de cette playlist sont manquantes</p>
                                    <BsmButton withBar={false} onClick={installPlaylist} className="rounded-md h-8 flex items-center justify-center px-4" typeColor="primary" text="Télécharger.les.maps.manquantes"/>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <ul className="min-h-0 w-full grow space-y-2 pl-2.5 pr-2 py-3 overflow-y-scroll overflow-x-hidden scrollbar-default">
                    {installedMaps.map(map => (
                        <MapItem
                            key={map.path}
                            hash={map.hash}
                            title={map.rawInfo._songName}
                            coverUrl={map.coverUrl}
                            songUrl={map.songUrl}
                            autor={map.rawInfo._levelAuthorName}
                            songAutor={map.rawInfo._songAuthorName}
                            bpm={map.rawInfo._beatsPerMinute}
                            duration={map.songDetails?.metadata.duration}
                            diffs={extractMapDiffs({ rawMapInfo: map.rawInfo, songDetails: map.songDetails })}
                            mapId={map.songDetails?.id}
                            ranked={map.songDetails?.ranked}
                            autorId={map.songDetails?.uploader.id}
                            likes={map.songDetails?.upVotes}
                            createdAt={map.songDetails?.uploadedAt}
                            callBackParam={null}
                        />
                    ))}
                </ul>
            </div>
        )
    }

    return (
        <PlaylistDetailsTemplate
            author={localPlaylist?.playlistAuthor}
            description={localPlaylist?.playlistDescription}
            image={localPlaylist?.image}
            duration={localPlaylist?.duration}
            maxNps={localPlaylist?.maxNps}
            minNps={localPlaylist?.minNps}
            nbMaps={localPlaylist?.nbMaps}
            nbMappers={localPlaylist?.nbMappers}
            title={localPlaylist?.playlistTitle}
        >
            {renderMaps()}
        </PlaylistDetailsTemplate>
    )
}
