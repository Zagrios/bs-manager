import ElectronStore from "electron-store";

export class ConfigurationService {

    private static instance: ConfigurationService;

    private readonly _stores: Map<string, ElectronStore>;
    private readonly _store: ElectronStore



    public static getInstance(): ConfigurationService{
        if(!ConfigurationService.instance){ ConfigurationService.instance = new ConfigurationService(); }
        return ConfigurationService.instance;
    }

    private constructor(){
        this._stores = new Map();
    }

    public get stores(): Map<string, ElectronStore> {return this._stores}
    public get store(): ElectronStore {return this._store}



    public set(key: string, value: any, store?: string, options?: ElectronStore.Options<Record<string, any>>): void{

      if(store && !this.stores.has(store)){
        this.stores.set(store, new ElectronStore(options));
      }

      const eStore = !store ? this._store : this.stores.get(store)
      eStore.set(key, value);
    }

    public get<T>(key: string,storeSelected : string): T{

      if (storeSelected === "store"){
        return this.store.get(key) as T;
      }
      if (storeSelected === "versionBsStore"){
        return this.store.get(key) as T;
      }
    }

    public delete(key: string,storeSelected : string): void{
      if (storeSelected === "store"){
        this.store.delete(key);
      }
      else if (storeSelected === "versionBsStore"){
        this.store.delete(key);
      }
    }

}
