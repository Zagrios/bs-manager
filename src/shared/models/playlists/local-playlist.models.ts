import { SongDetails } from "../maps";
import { BPList, PlaylistSong } from "./playlist.interface";

export interface LocalBPList extends BPList<LocalBpListSong> {
    path: string;
}

export interface LocalBpListSong {
    song: PlaylistSong;
    songDetails?: SongDetails;
    songUrl?: string;
    coverUrl?: string;
}
