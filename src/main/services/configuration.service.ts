import ElectronStore from "electron-store";
import fs from "fs-extra";
import { InstallationLocationService } from "./installation-location.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";

export class ConfigurationService {
    private static instance: ConfigurationService;

    public static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    private readonly locations: InstallationLocationService;

    private contentPath: string;
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

        this.contentPath = contentPath;
        this.store = new ElectronStore({
            cwd: contentPath,
            name: "config",
            fileExtension: "cfg",
            accessPropertiesByDotNotation: false,
        });
    }

    private checkStore(): void {
        // Can be null if config.cfg does not exist or corrupted
        if (!this.store) {
            throw CustomError.fromError(new Error(`Can't read config.cfg on ${this.contentPath}`));
        }
    }

    public set(key: string, value: unknown): void {
        this.checkStore();
        this.store.set(key, value);
    }

    public get<T>(key: string): T {
        this.checkStore();
        return this.store.get(key) as T;
    }

    public delete(key: string): void {
        this.checkStore();
        this.store.delete(key);
    }
}
