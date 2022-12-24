export class ModelSaberService {

    private static instance: ModelSaberService;

    public static getInstance(): ModelSaberService{
        if(!ModelSaberService.instance){ ModelSaberService.instance = new ModelSaberService(); }
        return ModelSaberService.instance;
    }

    private constructor(){}

}