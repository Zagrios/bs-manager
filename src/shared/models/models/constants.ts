import { MSGetQueryFilterType, MSGetSort, MSModelType } from "./model-saber.model";

export const MODEL_SABER_URL = "https://modelsaber.com";

export const MODEL_TYPE_FOLDERS = {
    [MSModelType.Avatar]: "CustomAvatars",
    [MSModelType.Bloq]: "CustomNotes",
    [MSModelType.Platfrom]: "CustomPlatforms",
    [MSModelType.Saber]: "CustomSabers"
}

export const MODELS_TYPE_MS_PAGE_ROOT = {
    [MSModelType.Avatar]: "Avatars",
    [MSModelType.Bloq]: "Bloqs",
    [MSModelType.Platfrom]: "Platforms",
    [MSModelType.Saber]: "Sabers"
}

export const MODEL_FILE_EXTENSIONS = {
    [MSModelType.Avatar]: ".avatar",
    [MSModelType.Bloq]: ".bloq",
    [MSModelType.Platfrom]: ".plat",
    [MSModelType.Saber]: ".saber"
}

export const MODEL_TYPES = Array.from(Object.values(MSModelType));
export const MS_GET_QUERY_SORTS = Array.from(Object.values(MSGetSort));

export const MS_QUERY_FILTER_TYPES = Array.from(Object.values(MSGetQueryFilterType));