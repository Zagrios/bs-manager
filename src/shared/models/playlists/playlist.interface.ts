import { BsvMapDetail, SongDetails } from "../maps";
import { BsmLocalMap } from "../maps/bsm-local-map.interface";
import { LocalBPListsDetails } from "./local-playlist.models";

export interface BPList<SongType = PlaylistSong> {
    playlistTitle: string;
    playlistAuthor: string;
    playlistDescription?: string;
    image: string;
    customData?: CustomDataBPList;
    songs: SongType[];
}

export interface PlaylistSong {
    key?: string;
    hash?: string;
    songName?: string;
    songDetails?: SongDetails;
    difficulties?: BPListDifficulty[];
    levelAuthorName?: string;
    levelid?: string;
}

export interface DownloadPlaylistProgressionData {
    downloadedMaps: BsmLocalMap[];
    currentDownload: BsvMapDetail;
    playlist: LocalBPListsDetails;
}

export interface CustomDataBPList {
    syncURL?: string;
}

export interface BPListDifficulty {
    name: string,
    characteristic: string,
}
