export class ModelSaberApiService {

    private static instance: ModelSaberApiService;

    public static getInstance(): ModelSaberApiService{
        if(!ModelSaberApiService.instance){ ModelSaberApiService.instance = new ModelSaberApiService(); }
        return ModelSaberApiService.instance;
    }

    private readonly API_URL = "https://modelsaber.com/api/v2";
    private readonly ENDPOINTS = {get: "get.php", types: "types.php"};

    private constructor(){}

    public searchModel(search: any): any{

    }

}