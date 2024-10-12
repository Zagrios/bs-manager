import { BsvMapDetail } from "./beat-saver.model";
import { MapInfo } from "./info/map-info.model";

export interface BsmLocalMap {
    hash: string;
    coverUrl: string;
    songUrl: string;
    mapInfo: MapInfo;
    bsaverInfo?: BsvMapDetail;
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
