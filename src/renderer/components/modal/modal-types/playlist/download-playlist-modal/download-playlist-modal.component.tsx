import { useObservable } from "renderer/hooks/use-observable.hook"
import { ModalComponent, ModalService } from "renderer/services/modale.service"
import { Observable, lastValueFrom } from "rxjs"
import { BSVersion } from "shared/bs-version.interface"
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models"
import { DownloadPlaylistModalHeader } from "./download-playlist-modal-header.component"
import { BsvPlaylist, BsvSearchOrder, PlaylistSearchParams } from "shared/models/maps/beat-saver.model"
import { useState } from "react"
import { useOnUpdate } from "renderer/hooks/use-on-update.hook"
import { useService } from "renderer/hooks/use-service.hook"
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service"
import { PlaylistItem } from "renderer/components/maps-playlists-panel/playlists/playlist-item.component"
import { PlaylistItemComponentPropsMapper } from "shared/mappers/playlist/playlist-item-component-props.mapper"
import { motion } from "framer-motion"
import { PlaylistDownloaderService } from "renderer/services/playlist-downloader.service"
import { BsvPlaylistDetailsModal } from "../playlist-details-modal/bsv-playlist-details-modal.component"
import { BsmImage } from "renderer/components/shared/bsm-image.component"
import BeatWaiting from "../../../../../../../assets/images/apngs/beat-waiting.png"
import BeatConflict from "../../../../../../../assets/images/apngs/beat-conflict.png"
import { cn } from "renderer/helpers/css-class.helpers"

// TODO : Translate

export const DownloadPlaylistModal: ModalComponent<void, {version: BSVersion, ownedPlaylists$: Observable<LocalBPListsDetails[]>, ownedMaps$: Observable<BsmLocalMap[]>}> = (
    { resolver, options: { data: { version, ownedPlaylists$, ownedMaps$ }} }
) => {

    const modal = useService(ModalService);
    const beatSaver = useService(BeatSaverService);
    const playlistDownloader = useService(PlaylistDownloaderService);

    const [playlists, setPlaylists] = useState<BsvPlaylist[]>(null);
    const ownedPlaylists = useObservable(() => ownedPlaylists$, []);
    const ownedMaps = useObservable(() => ownedMaps$, []);

    const [error, setError] = useState(false);
    const [searchParams, setSearchParams] = useState<PlaylistSearchParams>({
        q: "",
        sortOrder: BsvSearchOrder.Relevance,
        page: 0,
    });

    useOnUpdate(() => {
        beatSaver.searchPlaylists(searchParams)
            .then(playlists => setPlaylists(prev => [...(prev ?? []), ...(playlists ?? [])] ))
            .catch(() => setError(() => true));
    }, [searchParams])

    const handleNewSearch = (value: Omit<PlaylistSearchParams, "page">) => {
        setPlaylists(() => []);
        setSearchParams(() => ({ ...value, page: 0}));
    };

    const loadMorePlaylists = () => {
        setSearchParams(prev => ({ ...prev, page: prev.page + 1 }));
    };

    const openPlaylist = (playlist: BsvPlaylist) => {
        modal.openModal(BsvPlaylistDetailsModal, { data: { playlist, version, installedMaps$: ownedMaps$ }, noStyle: true })
    };

    return (
        <div className="max-w-[95vw] w-[970px] h-[85vh] flex flex-col gap-3">
            <DownloadPlaylistModalHeader className="h-9 w-full" value={searchParams} onSubmit={handleNewSearch}/>
            {(() => {
                if(!Array.isArray(playlists)){
                    return (
                        <div className="w-full flex flex-col justify-center items-center mt-44">
                            <BsmImage className={cn(["size-32", !error && "spin-loading"])} image={error ? BeatConflict : BeatWaiting} />
                            <p className="text-lg font-bold px-10 text-center">
                                {error ? "Une erreur est survenue lors du chargement des playlists" : "Chargement des playlists..."}
                            </p>
                        </div>
                    )
                }
                else if(playlists.length === 0){
                    return (
                        <div className="w-full flex flex-col justify-center items-center mt-44">
                            <BsmImage className="size-32" image={BeatConflict} />
                            <p className="text-lg font-bold px-10 text-center">
                                Aucune playlist trouvée
                            </p>
                        </div>
                    );
                }
                return (
                    <ul className="p-2 size-full flex flex-row flex-wrap justify-start content-start gap-3 grow overflow-y-scroll overflow-x-hidden z-[1]">
                        {playlists.map(playlist => (
                            <PlaylistItem
                                key={playlist.playlistId}
                                {...PlaylistItemComponentPropsMapper.fromBsvPlaylist(playlist)}
                                onClickOpen={() => openPlaylist(playlist)}
                                onClickDownload={() => lastValueFrom(playlistDownloader.downloadPlaylist({ downloadSource: playlist.downloadURL, ignoreSongsHashs: ownedMaps.map(map => map.hash), version }))}
                            />
                        ))}
                        <motion.span className="block w-full h-8" onViewportEnter={loadMorePlaylists}/>
                    </ul>
                )
            })()}
        </div>
    )
}
