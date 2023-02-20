import { BsvMapDetail } from "./beat-saver.model";
import { RawMapInfoData } from "./raw-map.model";

export interface BsmLocalMap {
    hash: string,
    coverUrl: string,
    songUrl: string,
    rawInfo: RawMapInfoData,
    bsaverInfo?: BsvMapDetail
    path: string
}

export interface BsmLocalMapsProgress {
    total: number,
    loaded: number,
    maps: BsmLocalMap[],
}

export interface DeleteMapsProgress {
    total: number,
    deleted: number
}