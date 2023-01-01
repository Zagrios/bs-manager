import ElectronStore from "electron-store";
import { InstallationLocationService } from "./installation-location.service";

export class ConfigurationService {

    private static instance: ConfigurationService;

    public static getInstance(): ConfigurationService{
        if(!ConfigurationService.instance){ ConfigurationService.instance = new ConfigurationService(); }
        return ConfigurationService.instance;
    }

    private readonly locations: InstallationLocationService;

    private store: ElectronStore;

    private constructor(){
        this.locations = InstallationLocationService.getInstance();
        this.initStore();

        this.locations.onInstallLocationUpdate(() => this.initStore());

    }

    private initStore(){
        const contentPath = this.locations.installationDirectory;
        this.store = new ElectronStore({
            cwd: contentPath,
            name: "config",
            fileExtension: "cfg",
        });
    }

    public set(key: string, value: unknown): void{
        this.store.set(key, value);
    }

    public get<T>(key: string): T{
        return this.store.get(key) as T;
    }

    public delete(key: string): void{
        this.store.delete(key);
    }

}
