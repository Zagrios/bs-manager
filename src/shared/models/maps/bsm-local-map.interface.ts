import { RawMapInfoData } from "./raw-map.model";
import { SongDetails } from "./song-details-cache/song-details-cache.model";

export interface BsmLocalMap {
    hash: string;
    coverUrl: string;
    songUrl: string;
    rawInfo: RawMapInfoData;
    songDetails?: SongDetails;
    path: string;
}

export interface BsmLocalMapsProgress {
    total: number;
    loaded: number;
    maps: BsmLocalMap[];
}

export interface DeleteMapsProgress {
    total: number;
    deleted: number;
}
