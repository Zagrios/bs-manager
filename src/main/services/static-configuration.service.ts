import ElectronStore from "electron-store";
import { pathExistsSync } from "fs-extra";
import path from "path";
import { PROTON_BINARY_PREFIX, WINE_BINARY_PREFIX } from "main/constants";
import { Observable, Subject } from "rxjs";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { BSVersion } from "shared/bs-version.interface";

export class StaticConfigurationService {
    private static instance: StaticConfigurationService;

    public static getInstance(): StaticConfigurationService {
        if (!StaticConfigurationService.instance) {
            StaticConfigurationService.instance = new StaticConfigurationService();
        }
        return StaticConfigurationService.instance;
    }

    private readonly store: ElectronStore;

    private readonly watchers: {
        [K in StaticConfigKeys]?: Subject<StaticConfigKeyValues[K]>;
    } = {};

    private constructor() {
        this.store = new ElectronStore();
    }

    public has<K extends StaticConfigKeys>(key: K): boolean {
        return this.store.has(key);
    }

    public get<K extends StaticConfigKeys>(key: K): StaticConfigKeyValues[K] {
        return this.store.get<K>(key) as StaticConfigKeyValues[K];
    }

    public take<K extends StaticConfigKeys>(key: K, cb: (val: StaticConfigKeyValues[K]) => void): void {
        cb(this.get(key));
    }

    public async set<K extends StaticConfigKeys>(key: K, value: StaticConfigKeyValues[K]): Promise<void> {
        // Validate the setters
        switch (key) {
            case "proton-folder":
                this.validateProtonFolder(value as string);
                break;

            default:
                break;
        }

        this.store.set(key, value);

        if (this.watchers[key]) {
            this.watchers[key].next(value); // update watchers if any
        }
    }

    // Setters with validation

    private validateProtonFolder(protonFolder: string): void {
        const protonPath = path.join(protonFolder, PROTON_BINARY_PREFIX);
        const winePath = path.join(protonFolder, WINE_BINARY_PREFIX);
        if (!pathExistsSync(protonPath) || !pathExistsSync(winePath)) {
            throw new CustomError("Invalid proton folder path", "invalid-folder");
        }
    }

    public delete<K extends StaticConfigKeys>(key: K): void {
        this.store.delete(key);
    }

    public getStore(): ElectronStore {
        return this.store;
    }

    public $watch<K extends StaticConfigKeys>(key: K): Observable<StaticConfigKeyValues[K]> {
        if (!this.watchers[key]) {
            this.watchers[key] = new Subject() as any; // avoid type error here, the essential is that it work using the function
        }

        return this.watchers[key];
    }
}

export interface StaticConfigKeyValues {
    "installation-folder": string;
    "song-details-cache-etag": string;
    "disable-hadware-acceleration": boolean;
    "use-symlinks": boolean;
    "use-system-proxy": boolean;
    "last-version-launched": BSVersion;
    "force-ipv4": boolean;

    // Linux Specific static configs
    "proton-folder": string;
    "versions": BSVersion[];
};

export type StaticConfigKeys = keyof StaticConfigKeyValues;

export type StaticConfigGetIpcRequestResponse<K extends StaticConfigKeys> = {
    request: K;
    response: StaticConfigKeyValues[K];
};

export type StaticConfigSetIpcRequest<K extends StaticConfigKeys> = {
    request: { key: K, value: StaticConfigKeyValues[K] };
    response: void;
};

