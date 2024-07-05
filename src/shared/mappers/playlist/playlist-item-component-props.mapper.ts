import { PlaylistItemComponentProps } from "renderer/components/maps-playlists-panel/playlists/playlist-item.component";
import { BsvPlaylist } from "shared/models/maps/beat-saver.model";
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";


export abstract class PlaylistItemComponentPropsMapper {


    static fromBsvPlaylist(playlist: BsvPlaylist): PlaylistItemComponentProps {
        return {
            title: playlist.name,
            author: playlist.owner.name,
            coverUrl: playlist.playlistImage,
            nbMaps: playlist.stats?.totalMaps,
            nbMappers: playlist.stats?.mapperCount,
            duration: playlist.stats?.totalDuration,
            maxNps: playlist.stats?.maxNps,
            minNps: playlist.stats?.minNps

        }
    }

    static fromLocalBPListDetails(playlist: LocalBPListsDetails): PlaylistItemComponentProps {
        return {
            title: playlist.playlistTitle,
            author: playlist.playlistAuthor,
            coverBase64: playlist.image,
            nbMaps: playlist.nbMaps,
            nbMappers: playlist.nbMappers,
            duration: playlist.duration,
            maxNps: playlist.maxNps,
            minNps: playlist.minNps
        };
    }

}
