import { BehaviorSubject, distinctUntilChanged, filter, Observable, Subscription } from "rxjs";

export class ProgressBarService{

    private static instance: ProgressBarService;

    private readonly _progression$: BehaviorSubject<number>;
    private readonly _visible$: BehaviorSubject<boolean>;

    private subscription: Subscription;

    public static getInstance(): ProgressBarService{
        if(!ProgressBarService.instance){ ProgressBarService.instance = new ProgressBarService(); }
        return ProgressBarService.instance;
    }

    private constructor(){
        this._progression$ = new BehaviorSubject<number>(0);
        this._visible$ = new BehaviorSubject<boolean>(false);
    }

    public subscribreTo(obs: Observable<number>){
        if(this.subscription){ this.unsubscribe(); }
        this.subscription = obs.pipe(distinctUntilChanged()).subscribe(value => {
            this.progression$.next(value);
        });
    }

    public unsubscribe(){
        this.subscription.unsubscribe();
        this.subscription = null;
    }

    public show(obs?: Observable<number>){
        if(obs){ this.subscribreTo(obs); }
        this.visible$.next(true); 
    }
    public hide(unsubscribe: boolean){
        if(unsubscribe){ this.unsubscribe(); } 
        this.visible$.next(false); 
    }

    public get progression$(): BehaviorSubject<number>{ return this._progression$; }
    public get visible$(): BehaviorSubject<boolean>{ return this._visible$; }





}