import ElectronStore from "electron-store";
import fs from "fs-extra";
import { InstallationLocationService } from "./installation-location.service";

export class ConfigurationService {
    private static instance: ConfigurationService;

    public static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    private readonly locations: InstallationLocationService;

    private store: ElectronStore;

    private constructor() {
        this.locations = InstallationLocationService.getInstance();
        this.initStore(false);

        this.locations.onInstallLocationUpdate(() => this.initStore(true));
    }

    private async initStore(createFolder: boolean) {
        const contentPath = this.locations.installationDirectory();
        if (!createFolder && !fs.pathExistsSync(contentPath)) {
            return;
        }

        this.store = new ElectronStore({
            cwd: contentPath,
            name: "config",
            fileExtension: "cfg",
            accessPropertiesByDotNotation: false,
        });
    }

    public set(key: string, value: unknown): void {
        this.store.set(key, value);
    }

    public get<T>(key: string): T {
        return this.store.get(key) as T;
    }

    public delete(key: string): void {
        this.store.delete(key);
    }
}
