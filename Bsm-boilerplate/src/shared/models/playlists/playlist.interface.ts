import { BsvMapDetail } from "../maps";
import { BsmLocalMap } from "../maps/bsm-local-map.interface";

export interface BPList {
    playlistTitle: string;
    playlistAuthor: string;
    playlistDescription?: string;
    image: string;
    customData: unknown;
    songs: PlaylistSong[];
}

export interface PlaylistSong {
    key: string;
    hash: string;
    songName: string;
    uploader?: string;
}

export interface DownloadPlaylistProgressionData {
    downloadedMaps: BsmLocalMap[];
    currentDownload: BsvMapDetail;
    playlistInfos: BPList;
    playlistPath: string;
}
