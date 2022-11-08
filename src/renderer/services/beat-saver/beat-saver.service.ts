import { splitIntoChunk } from "renderer/helpers/array-tools";
import { Observable } from "rxjs";
import { BsvMapDetail } from "shared/models/maps";
import { BeatSaverApiService } from "./beat-saver-api.service";

export class BeatSaverService {

    private static instance: BeatSaverService;

    public static getInstance(): BeatSaverService{
        if(!BeatSaverService.instance){ BeatSaverService.instance = new BeatSaverService(); }
        return BeatSaverService.instance;
    }

    private readonly bsaverApi: BeatSaverApiService;

    private constructor(){
        this.bsaverApi = BeatSaverApiService.getInstance();
    }

    public getMapDetailsFromHashs(hashs: string[]): Observable<BsvMapDetail[]>{
        const chunkHash = splitIntoChunk(hashs, 50);

        return new Observable(observer => {
            (async () => {

                const mapDetails: BsvMapDetail[] = [];

                for(const hashs of chunkHash){
                    const res = await this.bsaverApi.getMapsDetailsByHashs(hashs);
                    if(res.status === 200){
                        mapDetails.push(...Object.values<BsvMapDetail>(res.data));
                        observer.next(mapDetails);
                    }
                    
                }

                observer.complete();
            })()
        })

    }

}