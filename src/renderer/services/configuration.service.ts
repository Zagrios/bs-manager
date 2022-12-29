import { BehaviorSubject } from "rxjs";
import { DefaultConfigKey, defaultConfiguration } from "renderer/config/default-configuration.config";

export class ConfigurationService {
    
    private static instance: ConfigurationService;
    private observers: Map<string, BehaviorSubject<any>>;
    
    private constructor(){
        this.observers = new Map<string, BehaviorSubject<any>>();
    }
    private emitChange(key: string){
        if(this.observers.has(key)){
            const val = this.get(key);
            this.observers.get(key).next(val);
        }
    }

    private getPropperStorage(persistant : boolean){ return persistant ? window.localStorage : window.sessionStorage; }

    public static getInstance(): ConfigurationService{
        if(!ConfigurationService.instance){ ConfigurationService.instance = new ConfigurationService(); }
        return ConfigurationService.instance;
    }

    public get<Type>(key: string | DefaultConfigKey): Type{
        const t = JSON.parse(window.sessionStorage.getItem(key) || window.localStorage.getItem(key));
        if(!t){ return defaultConfiguration[key as DefaultConfigKey]; }
        return t;
    }

    public set(key: string, value: any, persistant = true){
        this.getPropperStorage(persistant).setItem(key, JSON.stringify(value));
        this.emitChange(key);
    }

    public delete(key: string){
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
        this.emitChange(key);
    }

    public watch<T>(key: DefaultConfigKey | string): BehaviorSubject<T>{
        if(this.observers.has(key)){ return this.observers.get(key); }
        this.observers.set(key, new BehaviorSubject(this.get(key)));
        return this.observers.get(key);
    }
}