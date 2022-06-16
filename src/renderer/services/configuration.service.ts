import { BehaviorSubject } from "rxjs";

export class ConfigurationService {
    
    private static instance: ConfigurationService;
    private subscribers: Map<string, BehaviorSubject<any>[]>;
    
    private constructor(){
        this.subscribers = new Map<string, BehaviorSubject<any>[]>();
    }

    public static getInstance(): ConfigurationService{
        if(!ConfigurationService.instance){ ConfigurationService.instance = new ConfigurationService(); }
        return ConfigurationService.instance;
    }

    public get<Type>(key: string): Type{
        const t = JSON.parse(window.localStorage.getItem(key));
        return t;
    }

    public set(key: string, value: any){
        window.localStorage.setItem(key, JSON.stringify(value));
        if(this.subscribers.has(key)){
            this.subscribers.get(key).forEach(sub => sub.next(value));
        }
    }

    public watch(key: string): BehaviorSubject<any>{
        const newSub = new BehaviorSubject(this.get(key));
        if(!this.subscribers.has(key)){ this.subscribers.set(key, []); }
        this.subscribers.get(key).push(newSub);
        return newSub;
    }

    public stopWatch(key: string, obs: BehaviorSubject<string>){
        const subs = this.subscribers.get(key);
        subs.splice(subs.indexOf(obs), 1);
    };
}