import ElectronStore from "electron-store";

export class ConfigurationService {

    private static instance: ConfigurationService;

    private readonly _store: ElectronStore;

    public static getInstance(): ConfigurationService{
        if(!ConfigurationService.instance){ ConfigurationService.instance = new ConfigurationService(); }
        return ConfigurationService.instance;
    }

    private constructor(){
        this._store = new ElectronStore();
    }

    public get store(): ElectronStore{ return this._store; }

    public set(key: string, value: any): void{
        this.store.set(key, value);
    }

    public get<T>(key: string): T{
        return this.store.get(key) as T;
    }

    public delete(key: string): void{
        this.store.delete(key);
    }

}