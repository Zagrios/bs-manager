import { ModalComponent } from "renderer/services/modale.service"
import { PlaylistDetailsTemplate, PlaylistDetailsTemplateProps } from "./playlist-details-template.component"
import { Observable } from "rxjs"
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { BSVersion } from "shared/bs-version.interface";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { MapItem } from "renderer/components/maps-playlists-panel/maps/map-item.component";
import { extractMapDiffs } from "renderer/components/maps-playlists-panel/maps/maps-row.component";
import { useService } from "renderer/hooks/use-service.hook";
import { AudioPlayerService } from "renderer/services/audio-player.service";

interface Props extends Omit<PlaylistDetailsTemplateProps, "children"> {
    version: BSVersion
    installedMaps$: Observable<BsmLocalMap[]>;
}

export const LocalPlaylistDetailsModal: ModalComponent<void, Props> = ({resolver, options}) => {

    const audioPlayer = useService(AudioPlayerService);

    const installedMaps = useObservable(() => options.data.installedMaps$, undefined);

    const playPlaylist = () => {
        if (!installedMaps) {
            return;
        }
        audioPlayer.play(installedMaps.map(map => ({ src: map.songUrl, bpm: map.rawInfo?._beatsPerMinute ?? 0})));
    };

    const renderMaps = () => {
        if (!installedMaps) {
            return null;
        }

        return (
            <ul className="space-y-2 overflow-y-scroll pr-2 pl-2.5 pt-2 pb-5 scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900">
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
        )
    }

    return (
        <PlaylistDetailsTemplate {...options.data}>
            {renderMaps()}
        </PlaylistDetailsTemplate>
    )
}
