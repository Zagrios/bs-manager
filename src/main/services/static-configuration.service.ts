import ElectronStore from "electron-store";
import { Observable } from "rxjs";
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

    private constructor() {
        this.store = new ElectronStore({ watch: true });
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

    public set<K extends StaticConfigKeys>(key: K, value: StaticConfigKeyValues[K]): void {
        this.store.set(key, value);
    }

    public delete<K extends StaticConfigKeys>(key: K): void {
        this.store.delete(key);
    }

    public getStore(): ElectronStore {
        return this.store;
    }

    public $watch<K extends StaticConfigKeys>(key: K): Observable<{ newValue: StaticConfigKeyValues[K], oldValue: StaticConfigKeyValues[K] }> {
        return new Observable(obs => {
            const unsub = this.store.onDidChange(key, (newValue, oldValue) => {
                obs.next({ newValue, oldValue } as { newValue: StaticConfigKeyValues[K], oldValue: StaticConfigKeyValues[K] });
            });

            return () => unsub();
        })
    }
}

export interface StaticConfigKeyValues {
    "versions": BSVersion[];
    "installation-folder": string;
    "song-details-cache-etag": string;
    "disable-hadware-acceleration": boolean;
    "use-symlinks": boolean;
}

export type StaticConfigKeys = keyof StaticConfigKeyValues;

export type StaticConfigGetIpcRequestResponse<K extends StaticConfigKeys> = {
    request: K;
    response: StaticConfigKeyValues[K];
};

export type StaticConfigSetIpcRequest<K extends StaticConfigKeys> = {
    request: { key: K, value: StaticConfigKeyValues[K] };
    response: void;
}

