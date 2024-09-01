import { StaticConfigKeys, StaticConfigKeyValues } from "main/services/static-configuration.service";
import { IpcService } from "./ipc.service";
import { lastValueFrom } from "rxjs";

export class StaticConfigurationService {

    private static instance: StaticConfigurationService;

    public static getInstance(): StaticConfigurationService {
        if (!StaticConfigurationService.instance) {
            StaticConfigurationService.instance = new StaticConfigurationService();
        }
        return StaticConfigurationService.instance;
    }

    private readonly ipc: IpcService;

    private constructor(){
        this.ipc = IpcService.getInstance();
    }

    public get<K extends StaticConfigKeys>(key: K): Promise<StaticConfigKeyValues[K]> {
        return lastValueFrom(this.ipc.sendV2("static-configuration.get", key)) as Promise<StaticConfigKeyValues[K]>;
    }

    public set<K extends StaticConfigKeys>(key: K, value: StaticConfigKeyValues[K]): Promise<void> {
        return lastValueFrom(this.ipc.sendV2("static-configuration.set", { key, value }));
    }

}
