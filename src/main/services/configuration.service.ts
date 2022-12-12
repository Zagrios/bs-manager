import { InstallationLocationService } from '../services/installation-location.service';
import ElectronStore from "electron-store";
import { Template } from 'webpack';

export class ConfigurationService {

    private static instance: ConfigurationService;

    private readonly _store: ElectronStore;
    private readonly _versionBsStore: ElectronStore;

    public static getInstance(): ConfigurationService{
        if(!ConfigurationService.instance){ ConfigurationService.instance = new ConfigurationService(); }
        return ConfigurationService.instance;
    }

    private constructor(){
        this._store = new ElectronStore();
        this._versionBsStore = new ElectronStore({cwd : InstallationLocationService.getInstance().installationDirectory});
    }

    public get store(): ElectronStore{ return this._store; }
    public get versionBsStore() : ElectronStore{ return this._versionBsStore;}

    public set(key: string, value: any, storeSelected : string): void{
      if (storeSelected === "store"){
        this.store.set(key, value);
      }
      else if (storeSelected === "versionBsStore")
      {
        this.versionBsStore.set(key, value);
      }
      else return null;
    }

    public get<T>(key: string,storeSelected : string): T{

      if (storeSelected === "store"){
        return this.store.get(key) as T;
      }
      else if (storeSelected === "versionBsStore"){
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
