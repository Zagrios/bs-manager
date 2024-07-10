import { ModalComponent, ModalExitCode } from "renderer/services/modale.service"
import { PlaylistDetailsTemplate } from "./playlist-details-template.component"
import { Observable, combineLatest, lastValueFrom, map, switchMap } from "rxjs"
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { BSVersion } from "shared/bs-version.interface";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { MapItem } from "renderer/components/maps-playlists-panel/maps/map-item.component";
import { useService } from "renderer/hooks/use-service.hook";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import BeatConflict from "../../../../../../../assets/images/apngs/beat-conflict.png";
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { PlaylistDownloaderService } from "renderer/services/playlist-downloader.service";
import { PlaylistHeaderState } from "./playlist-header-state.component";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { useCallback } from "react";
import { VirtualScroll } from "renderer/components/shared/virtual-scroll/virtual-scroll.component";
import { MapItemComponentPropsMapper } from "shared/mappers/map/map-item-component-props.mapper";
import { useTranslation } from "renderer/hooks/use-translation.hook";

interface Props {
    version: BSVersion;
    localPlaylist$: Observable<LocalBPListsDetails>;
    installedMaps$: Observable<BsmLocalMap[]>;
}

export const LocalPlaylistDetailsModal: ModalComponent<void, Props> = ({resolver, options}) => {

    const t = useTranslation();

    const playlistDownloader = useService(PlaylistDownloaderService);

    const localPlaylist = useObservable(() => options.data.localPlaylist$, null);
    const installedMaps = useObservable(() => options.data.installedMaps$, null);

    const isMissingMaps$ = useConstant(() => combineLatest([options.data.installedMaps$, options.data.localPlaylist$]).pipe(map(([maps, playlist]) => maps.length !== playlist.songs.length)));
    const isPlaylistDownloading$ = useConstant(() => options.data.localPlaylist$.pipe(switchMap(playlist => playlistDownloader.$isPlaylistDownloading(playlist.path, options.data.version))));
    const isPlaylistInQueue$ = useConstant(() => options.data.localPlaylist$.pipe(switchMap(playlist => playlistDownloader.$isPlaylistInQueue(playlist.path, options.data.version))));

    const isInQueue = useObservable(() => isPlaylistInQueue$, false);

    const installPlaylist = () => {

        const ignoreSongsHashs = installedMaps?.map(map => map.hash);

        const obs$ = playlistDownloader.downloadPlaylist({
            downloadSource: localPlaylist.path,
            dest: localPlaylist.path,
            version: options.data.version,
            ignoreSongsHashs,
        });

        return lastValueFrom(obs$);
    }

    const renderMapItem = useCallback((map: BsmLocalMap) => {
        return (
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
                diffs={MapItemComponentPropsMapper.extractMapDiffs({ rawMapInfo: map.rawInfo, songDetails: map.songDetails })}
                mapId={map.songDetails?.id}
                ranked={map.songDetails?.ranked}
                autorId={map.songDetails?.uploader.id}
                likes={map.songDetails?.upVotes}
                createdAt={map.songDetails?.uploadedAt}
                callBackParam={null}
            />
        );
    }, []);

    const renderMaps = () => {

        if (!Array.isArray(installedMaps) || !localPlaylist) {
            return (
                <div className="grow bg-red-400">
                    Error
                </div>
            );
        }

        if(!localPlaylist.songs?.length){
            return (
                <div className="grow flex justify-center items-center flex-col">
                    <BsmImage image={BeatConflict} className="size-28"/>
                    <div className="dark:text-white font-bold w-fit space-y-1.5 flex flex-col justify-center items-center -translate-y-5">
                        <p>{t("playlist.playlist-contain-no-maps")}</p>
                    </div>
                </div>
            );
        }

        if(!installedMaps.length && localPlaylist.songs?.length && !isInQueue) {
            return (
                <div className="grow flex justify-center items-center flex-col">
                    <BsmImage image={BeatConflict} className="size-28"/>
                    <div className="dark:text-white font-bold w-fit space-y-1.5 flex flex-col justify-center items-center -translate-y-5">
                        <p>{t("playlist.no-map-installed-for-playlist")}</p>
                        <BsmButton withBar={false} onClick={installPlaylist} className="rounded-md h-8 flex items-center justify-center px-4" typeColor="primary" text="playlist.download-maps"/>
                    </div>
                </div>
            );
        }

        if(!installedMaps.length && isInQueue) {
            return (
                <div className="grow flex justify-center items-center flex-col">
                    <BsmImage image={BeatConflict} className="size-28"/>
                    <div className="dark:text-white font-bold w-fit space-y-1.5 flex flex-col justify-center items-center -translate-y-5">
                        <p>{t("playlist.playlist-is-waiting-to-download")}</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="grow min-h-0 overflow-hidden flex flex-col justify-start items-center">
                <PlaylistHeaderState
                    isMissingMaps$={isMissingMaps$}
                    isPlaylistDownloading$={isPlaylistDownloading$}
                    isPlaylistInQueue$={isPlaylistInQueue$}
                    installPlaylist={installPlaylist}
                />
                <VirtualScroll
                    maxColumns={1}
                    minItemWidth={300}
                    itemHeight={110}
                    items={installedMaps}
                    renderItem={renderMapItem}
                    classNames={{
                        mainDiv: "min-h-0 w-full grow",
                        rows: "my-2.5 px-2.5"
                    }}

                />
            </div>
        )
    }

    return (
        <PlaylistDetailsTemplate
            author={localPlaylist?.playlistAuthor}
            description={localPlaylist?.playlistDescription}
            imagebase64={localPlaylist?.image}
            duration={localPlaylist?.duration}
            maxNps={localPlaylist?.maxNps}
            minNps={localPlaylist?.minNps}
            nbMaps={localPlaylist?.nbMaps}
            nbMappers={localPlaylist?.nbMappers}
            title={localPlaylist?.playlistTitle}
            onClose={() => resolver({ exitCode: ModalExitCode.CLOSED })}
        >
            {renderMaps()}
        </PlaylistDetailsTemplate>
    )
}
