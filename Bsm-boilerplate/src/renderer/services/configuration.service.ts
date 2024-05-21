import { BehaviorSubject, Observable } from "rxjs";
import { DefaultConfigKey, defaultConfiguration } from "renderer/config/default-configuration.config";
import { tryit } from "shared/helpers/error.helpers";

export class ConfigurationService {
    private static instance: ConfigurationService;
    private observers: Map<string, BehaviorSubject<unknown>>;

    private constructor() {
        this.observers = new Map<string, BehaviorSubject<unknown>>();
    }
    private emitChange(key: string) {
        if (this.observers.has(key)) {
            const val = this.get(key);
            this.observers.get(key).next(val);
        }
    }

    private getPropperStorage(persistant: boolean) {
        return persistant ? window.localStorage : window.sessionStorage;
    }

    public static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    public get<Type>(key: string | DefaultConfigKey): Type {
        const rawValue = (window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key));
        const tryParse = tryit<Type>(() => JSON.parse(rawValue));
        
        const res = (tryParse.error ? rawValue : tryParse.result) as Type;

        if(!res && Object.keys(defaultConfiguration).includes(key)){
            return defaultConfiguration[key as DefaultConfigKey] as Type;
        }

        return res;
    }

    public set(key: string, value: unknown, persistant = true) {

        if(value != null){
            this.getPropperStorage(persistant).setItem(key, JSON.stringify(value));
        } else {
            this.getPropperStorage(persistant).removeItem(key);
        }

        this.emitChange(key);
    }

    public delete(key: string) {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
        this.emitChange(key);
    }

    public watch<T>(key: DefaultConfigKey | string): Observable<T> {
        if (this.observers.has(key)) {
            return this.observers.get(key).asObservable() as Observable<T>;
        }
        this.observers.set(key, new BehaviorSubject(this.get(key)));
        return this.observers.get(key).asObservable() as Observable<T>;
    }
}
