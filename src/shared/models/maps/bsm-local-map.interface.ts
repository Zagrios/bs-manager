import { BsvMapDetail } from "./beat-saver.model";
import { RawMapInfoData } from "./raw-map.model";

export interface BsmLocalMap {
    hash: string,
    coverUrl: string,
    songUrl: string,
    rawInfo: RawMapInfoData,
    bsaverInfo?: BsvMapDetail
}