import { BsvMapDetail } from "shared/models/maps";

export class BeatSaverService {

    private static instance: BeatSaverService;

    public static getInstance(): BeatSaverService{
        if(!BeatSaverService.instance){ BeatSaverService.instance = new BeatSaverService(); }
        return BeatSaverService.instance;
    }

    private constructor(){}

    public getMapDetailsFromHashs(hashs: string[]): BsvMapDetail{
        return null;
    }

}