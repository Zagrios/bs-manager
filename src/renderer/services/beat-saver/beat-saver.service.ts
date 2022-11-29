import { splitIntoChunk } from "renderer/helpers/array-tools";
import { of } from "rxjs";
import { Observable } from "rxjs";
import { BsvMapDetail } from "shared/models/maps";
import { OsDiagnosticService } from "../os-diagnostic.service";
import { BeatSaverApiService } from "./beat-saver-api.service";

export class BeatSaverService {

    private static instance: BeatSaverService;

    public static getInstance(): BeatSaverService{
        if(!BeatSaverService.instance){ BeatSaverService.instance = new BeatSaverService(); }
        return BeatSaverService.instance;
    }

    private readonly bsaverApi: BeatSaverApiService;
    private readonly os: OsDiagnosticService;

    private readonly cachedMapsDetails = new Map<string, BsvMapDetail>()


    private constructor(){
        this.bsaverApi = BeatSaverApiService.getInstance();
        this.os = OsDiagnosticService.getInstance();
    }

    public getMapDetailsFromHashs(hashs: string[]): Observable<BsvMapDetail[]>{

        const filtredHashs = hashs.map(h => h.toLowerCase()).filter(hash => !Array.from(this.cachedMapsDetails.keys()).includes(hash));
        const chunkHash = splitIntoChunk(filtredHashs, 50);

        const mapDetails = Array.from(this.cachedMapsDetails.entries()).reduce((res , [hash, details]) => {
            if(hashs.includes(hash)){
                res.push(details);
            }
            return res;
        }, [] as BsvMapDetail[]);

        if(this.os.isOffline){
            return of(mapDetails);
        }

        return new Observable(observer => {
            (async () => {

                for(const hashs of chunkHash){

                    const res = await this.bsaverApi.getMapsDetailsByHashs(hashs);

                    if(res.status === 200){
                        mapDetails.push(...Object.values<BsvMapDetail>(res.data));
                        mapDetails.forEach(detail => this.cachedMapsDetails.set(detail.versions.at(0).hash.toLowerCase(), detail));
                    }

                    if(mapDetails.length > 0){
                        observer.next(mapDetails);
                    }
                    
                }

                observer.complete();
            })()
        })

    }

}