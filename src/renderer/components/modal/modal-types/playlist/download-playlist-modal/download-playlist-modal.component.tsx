import { useObservable } from "renderer/hooks/use-observable.hook"
import { ModalComponent } from "renderer/services/modale.service"
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

// TODO : Translate

export const DownloadPlaylistModal: ModalComponent<void, {version: BSVersion, ownedPlaylists$: Observable<LocalBPListsDetails[]>, ownedMaps$: Observable<BsmLocalMap[]>}> = (
    { resolver, options: { data: { version, ownedPlaylists$, ownedMaps$ }} }
) => {

    const beatSaver = useService(BeatSaverService);
    const playlistDownloader = useService(PlaylistDownloaderService);

    const [playlists, setPlaylists] = useState<BsvPlaylist[]>([]);
    const ownedPlaylists = useObservable(() => ownedPlaylists$, []);
    const ownedMaps = useObservable(() => ownedMaps$, []);

    const [loading, setLoading] = useState(false);
    const [searchParams, setSearchParams] = useState<PlaylistSearchParams>({
        q: "",
        sortOrder: BsvSearchOrder.Relevance,
        page: 0,
    });

    useOnUpdate(() => {
        setLoading(() => true);
        beatSaver.searchPlaylists(searchParams)
            .then(playlists => setPlaylists(prev => [...prev, ...playlists]))
            .finally(() => setLoading(() => false));
    }, [searchParams])

    const handleNewSearch = (value: Omit<PlaylistSearchParams, "page">) => {
        setPlaylists(() => []);
        setSearchParams(() => ({ ...value, page: 0}));
    };

    const loadMorePlaylists = () => {
        setSearchParams(prev => ({ ...prev, page: prev.page + 1 }));
    };

    return (
        <div className="max-w-[95vw] w-[970px] h-[85vh] flex flex-col gap-3">
            <DownloadPlaylistModalHeader className="h-9 w-full" value={searchParams} onSubmit={handleNewSearch}/>
            {(() => {
                if(loading && playlists.length === 0){
                    return <div className="flex justify-center items-center h-full w-full">Loading...</div>
                }
                else if(playlists.length === 0){
                    return <div className="flex justify-center items-center h-full w-full">No playlists found</div>
                }
                return (
                    <ul className="p-2 size-full flex flex-row flex-wrap justify-start content-start gap-3 grow overflow-y-scroll overflow-x-hidden z-10">
                        {playlists.map(playlist => (
                            <PlaylistItem
                                key={playlist.playlistId}
                                {...PlaylistItemComponentPropsMapper.fromBsvPlaylist(playlist)}
                                onClickSync={() => lastValueFrom(playlistDownloader.downloadPlaylist({ downloadSource: playlist.downloadURL, ignoreSongsHashs: ownedMaps.map(map => map.hash), version }))}
                            />
                        ))}
                        <motion.span className="block w-full h-8" onViewportEnter={loadMorePlaylists}/>
                    </ul>
                )
            })()}
        </div>
    )
}
