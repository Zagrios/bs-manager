import { MSGetQuery, MSGetQueryFilter, MSGetQueryFilterType, MSModel } from "shared/models/models/model-saber.model";
import { IpcService } from "../ipc.service";
import { Observable, lastValueFrom } from "rxjs";
import { MS_QUERY_FILTER_TYPES } from "shared/models/models/constants";

export class ModelSaberService {
    private static instance: ModelSaberService;

    public static getInstance(): ModelSaberService {
        if (!ModelSaberService.instance) {
            ModelSaberService.instance = new ModelSaberService();
        }
        return ModelSaberService.instance;
    }

    private readonly ipc: IpcService;

    private constructor() {
        this.ipc = IpcService.getInstance();
    }

    public getModelById(id: number | string): Promise<MSModel> {
        return lastValueFrom(this.ipc.sendV2("ms-get-model-by-id", id));
    }

    public searchModels(query: MSGetQuery): Observable<MSModel[]> {
        return this.ipc.sendV2("search-models", query);
    }

    public parseFilter(stringFilters: string): MSGetQueryFilter[] {
        return stringFilters.split(" ").map(value => {
            let trimed = value.trim();
            const isNegative = trimed.at(0) === "-";

            if (isNegative) {
                trimed = trimed.substring(0);
            }

            if (!trimed.includes(":")) {
                return { type: MSGetQueryFilterType.SearchName, value: trimed, isNegative };
            }

            const [filterType, filterValue] = trimed.split(":");

            if (MS_QUERY_FILTER_TYPES.includes(filterType as MSGetQueryFilterType)) {
                return { type: filterType as MSGetQueryFilterType, value: filterValue, isNegative };
            }

            return { type: MSGetQueryFilterType.SearchName, value: trimed, isNegative };
        });
    }
}
