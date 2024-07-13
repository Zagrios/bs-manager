import { useObservable } from "renderer/hooks/use-observable.hook"
import { ModalComponent, ModalService } from "renderer/services/modale.service"
import { Observable, lastValueFrom } from "rxjs"
import { BSVersion } from "shared/bs-version.interface"
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models"
import { DownloadPlaylistModalHeader } from "./download-playlist-modal-header.component"
import { BsvPlaylist, BsvSearchOrder, PlaylistSearchParams } from "shared/models/maps/beat-saver.model"
import { useCallback, useState } from "react"
import { useOnUpdate } from "renderer/hooks/use-on-update.hook"
import { useService } from "renderer/hooks/use-service.hook"
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service"
import { PlaylistItem } from "renderer/components/maps-playlists-panel/playlists/playlist-item.component"
import { PlaylistItemComponentPropsMapper } from "shared/mappers/playlist/playlist-item-component-props.mapper"
import { PlaylistDownloaderService } from "renderer/services/playlist-downloader.service"
import { BsvPlaylistDetailsModal } from "../playlist-details-modal/bsv-playlist-details-modal.component"
import { BsmImage } from "renderer/components/shared/bsm-image.component"
import BeatWaiting from "../../../../../../../assets/images/apngs/beat-waiting.png"
import BeatConflict from "../../../../../../../assets/images/apngs/beat-conflict.png"
import { cn } from "renderer/helpers/css-class.helpers"
import { VirtualScroll } from "renderer/components/shared/virtual-scroll/virtual-scroll.component"
import { useTranslation } from "renderer/hooks/use-translation.hook"

export const DownloadPlaylistModal: ModalComponent<void, {version: BSVersion, ownedPlaylists$: Observable<LocalBPListsDetails[]>, ownedMaps$: Observable<BsmLocalMap[]>}> = (
    { options: { data: { version, ownedPlaylists$, ownedMaps$ }} }
) => {

    const t = useTranslation();

    const modal = useService(ModalService);
    const beatSaver = useService(BeatSaverService);
    const playlistDownloader = useService(PlaylistDownloaderService);

    const [playlists, setPlaylists] = useState<BsvPlaylist[]>(null);
    const [downloadablePlaylists, setDownloadablePlaylists] = useState<DownloadablePlaylist[]>(null);

    const ownedPlaylists = useObservable(() => ownedPlaylists$, []);
    const ownedMaps = useObservable(() => ownedMaps$, []);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [searchParams, setSearchParams] = useState<PlaylistSearchParams>({
        q: "",
        sortOrder: BsvSearchOrder.Relevance,
        page: 0,
    });

    useOnUpdate(() => {
        setDownloadablePlaylists(() => playlists?.map(playlist => ({
                playlist,
                isOwned: ownedPlaylists.some(ownedPlaylist => ownedPlaylist.id === playlist.playlistId),
                ownedMaps
        })));
    }, [playlists, ownedPlaylists, ownedMaps])

    useOnUpdate(() => {
        setLoading(() => true);
        beatSaver.searchPlaylists(searchParams)
            .then(playlists => setPlaylists(prev => [...(prev ?? []), ...(playlists ?? [])] ))
            .catch(() => setError(() => true))
            .finally(() => setLoading(() => false));
    }, [searchParams]);

    const handleNewSearch = (value: Omit<PlaylistSearchParams, "page">) => {
        setPlaylists(() => undefined);
        setSearchParams(() => ({ ...value, page: 0}));
    };

    const openPlaylist = (playlist: BsvPlaylist) => {
        modal.openModal(BsvPlaylistDetailsModal, { data: { playlist, version, installedMaps$: ownedMaps$ }, noStyle: true })
    };

    const loadMorePlaylists = () => {
        if(loading){ return; }
        setSearchParams(prev => ({ ...prev, page: prev.page + 1 }));
    };

    const renderPlaylist = useCallback((downloadablePlaylists: DownloadablePlaylist) => {

        const { playlist } = downloadablePlaylists;

        const onClickDownload =  () => {
            lastValueFrom(playlistDownloader.downloadPlaylist({
                downloadSource: playlist.downloadURL,
                ignoreSongsHashs: downloadablePlaylists.ownedMaps.map(map => map.hash),
                version
            }));
        }

        return (
            <PlaylistItem
                key={playlist.playlistId}
                {...PlaylistItemComponentPropsMapper.fromBsvPlaylist(playlist)}
                isDownloading$={playlistDownloader.$isPlaylistDownloading(playlist.downloadURL, version)}
                isInQueue$={playlistDownloader.$isPlaylistInQueue(playlist.downloadURL, version)}
                onClickOpen={() => openPlaylist(playlist)}
                onClickDownload={downloadablePlaylists.isOwned ? null : onClickDownload}
                onClickSync={downloadablePlaylists.isOwned ? onClickDownload : null}
                onClickCancelDownload={() => playlistDownloader.cancelDownload(playlist.downloadURL, version)}
            />
        );
    }, [version]);

    return (
        <div className="max-w-[95vw] w-[970px] h-[85vh] flex flex-col gap-3">
            <DownloadPlaylistModalHeader className="h-9 w-full" value={searchParams} onSubmit={handleNewSearch}/>
            {(() => {
                if(!Array.isArray(downloadablePlaylists)){
                    return (
                        <div className="w-full flex flex-col justify-center items-center mt-44">
                            <BsmImage className={cn(["size-32", !error && "spin-loading"])} image={error ? BeatConflict : BeatWaiting} />
                            <p className="text-lg font-bold px-10 text-center">
                                {error ? t("playlist.error-occur-while-loading-playlists") : t("playlist.playlists-loading")}
                            </p>
                        </div>
                    )
                }
                if(downloadablePlaylists.length === 0){
                    return (
                        <div className="w-full flex flex-col justify-center items-center mt-44">
                            <BsmImage className="size-32" image={BeatConflict} />
                            <p className="text-lg font-bold px-10 text-center">
                                {t("playlist.no-playlists-found")}
                            </p>
                        </div>
                    );
                }
                return (
                    <VirtualScroll
                        classNames={{
                            mainDiv: "size-full",
                            rows: "gap-2 px-2 py-2"
                        }}
                        itemHeight={120}
                        items={downloadablePlaylists}
                        maxColumns={2}
                        minItemWidth={80}
                        scrollEnd={{
                            onScrollEnd: loadMorePlaylists,
                            margin: 120
                        }}
                        renderItem={renderPlaylist}
                    />
                )
            })()}
        </div>
    )
}

type DownloadablePlaylist = {
    playlist: BsvPlaylist;
    isOwned: boolean;
    ownedMaps: BsmLocalMap[];
}
