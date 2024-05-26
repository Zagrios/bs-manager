import { splitIntoChunk } from "../../../../shared/helpers/array.helpers";
import { BsvMapDetail } from "shared/models/maps";
import { BsvPlaylist, BsvPlaylistPage, PlaylistSearchParams, SearchParams } from "shared/models/maps/beat-saver.model";
import { BeatSaverApiService } from "./beat-saver-api.service";
import log from "electron-log";

export class BeatSaverService {
    private static instance: BeatSaverService;

    public static getInstance(): BeatSaverService {
        if (!BeatSaverService.instance) {
            BeatSaverService.instance = new BeatSaverService();
        }
        return BeatSaverService.instance;
    }

    private readonly bsaverApi: BeatSaverApiService;

    private readonly cachedMapsDetails = new Map<string, BsvMapDetail>();

    private constructor() {
        this.bsaverApi = BeatSaverApiService.getInstance();
    }

    public async getMapDetailsFromHashs(hashs: string[]): Promise<BsvMapDetail[]> {
        const filtredHashs = hashs.map(h => h.toLowerCase()).filter(hash => !Array.from(this.cachedMapsDetails.keys()).includes(hash));
        const chunkHash = splitIntoChunk(filtredHashs, 50);

        const mapDetails = Array.from(this.cachedMapsDetails.entries()).reduce((res, [hash, details]) => {
            if (hashs.includes(hash)) {
                res.push(details);
            }
            return res;
        }, [] as BsvMapDetail[]);

        await Promise.allSettled(
            chunkHash.map(async hashs => {
                const res = await this.bsaverApi.getMapsDetailsByHashs(hashs);

                mapDetails.push(...Object.values<BsvMapDetail>(res).filter(detail => !!detail));
                mapDetails.forEach(detail => {
                    this.cachedMapsDetails.set(detail.versions.at(0).hash.toLowerCase(), detail);
                });
            })
        );

        return mapDetails;
    }

    public async getMapDetailsById(id: string): Promise<BsvMapDetail> {
        return this.bsaverApi.getMapDetailsById(id);
    }

    public searchMaps(search: SearchParams): Promise<BsvMapDetail[]> {
        return this.bsaverApi
            .searchMaps(search)
            .then(res => {
                return res.docs;
            })
            .catch(e => {
                log.error(e);
                return e;
            });
    }

    public searchPlaylists(search: PlaylistSearchParams): Promise<BsvPlaylist[]> {
        return this.bsaverApi
            .searchPlaylists(search)
            .then(res => res.docs)
            .catch(e => {
                log.error(e);
                throw e;
            });
    }

    public getPlaylistDetailsById(id: string, page = 0): Promise<BsvPlaylistPage> {
        return this.bsaverApi.getPlaylistDetailsById(id, page)
            .catch(e => {
                log.error(e);
                throw e;
            });
    }
}
