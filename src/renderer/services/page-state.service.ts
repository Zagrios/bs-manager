import { Location } from "history";
import { map } from "rxjs/operators";
import { BehaviorSubject, Observable } from "rxjs";

export class PageStateService {

    private static instance: PageStateService;

    private readonly location$: BehaviorSubject<Location> = new BehaviorSubject(null);;

    public static getInstance(): PageStateService{
        if(!PageStateService.instance){ PageStateService.instance = new PageStateService(); }
        return PageStateService.instance;
    }

    private constructor(){}

    public setLocation(location: Location){
        this.location$.next(location);
    }

    public getState<T = unknown>(): T{
        return this.location$.getValue().state as T;
    }

    public getRoute(): string{
        return this.location$.value?.pathname;
    }

    public get state$(): Observable<unknown>{
        return this.location$.pipe(map(location => location.state));
    }

    public get route$(): Observable<string>{
        return this.location$.pipe(map(location => location?.pathname));
    }

}