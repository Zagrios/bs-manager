import { BsvMapDetail } from "shared/models/maps";
import { BsvPlaylist, BsvPlaylistPage, PlaylistSearchParams, SearchParams } from "shared/models/maps/beat-saver.model";
import { IpcService } from "../ipc.service";
import { lastValueFrom } from "rxjs";

export class BeatSaverService {
    private static instance: BeatSaverService;

    public static getInstance(): BeatSaverService {
        if (!BeatSaverService.instance) {
            BeatSaverService.instance = new BeatSaverService();
        }
        return BeatSaverService.instance;
    }
    private readonly ipc: IpcService;

    private constructor() {
        this.ipc = IpcService.getInstance();
    }

    public async getMapDetailsFromHashs(hashs: string[]): Promise<BsvMapDetail[]> {
        return lastValueFrom(this.ipc.sendV2("bsv-get-map-details-from-hashs", hashs));
    }

    public async getMapDetailsById(id: string): Promise<BsvMapDetail> {
        return  lastValueFrom(this.ipc.sendV2("bsv-get-map-details-by-id", id));
    }

    public async searchMaps(search: SearchParams): Promise<BsvMapDetail[]> {
        return lastValueFrom(this.ipc.sendV2("bsv-search-map", search));
    }

    public async searchPlaylists(search: PlaylistSearchParams): Promise<BsvPlaylist[]> {
        return lastValueFrom(this.ipc.sendV2("bsv-search-playlist", search));
    }

    public async getPlaylistDetailsById(id: string, page = 0): Promise<BsvPlaylistPage> {
        return lastValueFrom(this.ipc.sendV2("bsv-get-playlist-details-by-id", { id, page }));
    }
}
