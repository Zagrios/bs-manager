import { BsvMapDetail } from "shared/models/maps";
import { BsvPlaylist, BsvPlaylistPage, SearchParams } from "shared/models/maps/beat-saver.model";
import { IpcService } from "../ipc.service";

export class BeatSaverService {

    private static instance: BeatSaverService;

    public static getInstance(): BeatSaverService{
        if(!BeatSaverService.instance){ BeatSaverService.instance = new BeatSaverService(); }
        return BeatSaverService.instance;
    }
    private readonly ipc: IpcService;

    private constructor(){
        this.ipc = IpcService.getInstance();
    }

    public async getMapDetailsFromHashs(hashs: string[]): Promise<BsvMapDetail[]>{
        const res = await this.ipc.send<BsvMapDetail[], string[]>("bsv-get-map-details-from-hashs", {args: hashs});
        return res.data ?? [];
    }


    public async getMapDetailsById(id: string): Promise<BsvMapDetail>{
        const res = await this.ipc.send<BsvMapDetail, string>("bsv-get-map-details-by-id", {args: id});
        return res.data ?? null;
    }

    public async searchMaps(search: SearchParams): Promise<BsvMapDetail[]>{
        const res = await this.ipc.send<BsvMapDetail[], SearchParams>("bsv-search-map", {args: search});
        return res.data ?? []
    }

    public async getPlaylistDetailsById(id: string): Promise<BsvPlaylist>{
        const res = await this.ipc.send<BsvPlaylist>("bsv-get-playlist-details-by-id", {args: id});
        return res.data ?? null;
    }



}