import { Console } from "console";
import ElectronStore from "electron-store";



export class ConfigurationService {

    private static instance: ConfigurationService;

    private readonly _stores: Map<string, ElectronStore>;
    private readonly _storeFixe: ElectronStore



    public static getInstance(): ConfigurationService{
        if(!ConfigurationService.instance){ ConfigurationService.instance = new ConfigurationService(); }
        return ConfigurationService.instance;
    }

    private constructor(){

        this._stores = new Map();
        this._storeFixe = new ElectronStore();
    }

    private getPropperStore(selectedStore?: string) : ElectronStore {
      if(selectedStore){
        return this._stores.get(selectedStore);
      }
      return this._storeFixe;

    }


    public set(key: string, value: any, selectedStore?: string, path?: string): void{
      if(selectedStore && !this._stores.has(selectedStore)){
        this._stores.set(selectedStore, new ElectronStore({cwd:path,name:selectedStore}));
      }

      const eStore = this.getPropperStore(selectedStore);
      eStore.set(key,value);

    }

    public get<T>(key: string,selectedStore?: string): T{

      const eStore = this.getPropperStore(selectedStore);

      if(!eStore){ return; }
      return eStore.get(key) as T;

    }

    public delete(key: string,selectedStore : string): void{

       this.getPropperStore(selectedStore)?.delete(key);

    }

}
