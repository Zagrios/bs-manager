import { BehaviorSubject } from "rxjs";

export class PageStateService {

    private static instance: PageStateService;

    private readonly _state$: BehaviorSubject<any> = new BehaviorSubject(undefined);

    public static getInstance(): PageStateService{
        if(!PageStateService.instance){ PageStateService.instance = new PageStateService(); }
        return PageStateService.instance;
    }

    private constructor(){
        this.state$.subscribe(a => console.log(a))
    }

    public setState(state: unknown){
        this._state$.next(state);
    }

    public getState<T = unknown>(): T{
        return this._state$.value;
    }

    public get state$(){
        return this._state$.asObservable();
    }

}