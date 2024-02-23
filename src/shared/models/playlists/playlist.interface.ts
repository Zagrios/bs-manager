import { BsvMapDetail, SongDetails } from "../maps";
import { BsmLocalMap } from "../maps/bsm-local-map.interface";

export interface BPList<SongType = PlaylistSong> {
    playlistTitle: string;
    playlistAuthor: string;
    playlistDescription?: string;
    image: string;
    customData: unknown;
    songs: SongType[];
}

export interface PlaylistSong {
    key: string;
    hash: string;
    songName: string;
    uploader?: string;
    songDetails?: SongDetails;
}

export interface DownloadPlaylistProgressionData {
    downloadedMaps: BsmLocalMap[];
    currentDownload: BsvMapDetail;
    playlistInfos: BPList;
    playlistPath: string;
}
