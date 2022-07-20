import { distinctUntilChanged, map } from "rxjs/operators";
import { BehaviorSubject, Observable, Subscription, timer } from "rxjs";
import { IpcService } from "./ipc.service";

export class ProgressBarService{

    private static instance: ProgressBarService;

    private readonly ipcService: IpcService;

    private readonly _progression$: BehaviorSubject<number>;
    private readonly _visible$: BehaviorSubject<boolean>;

    private subscription: Subscription;

    public static getInstance(): ProgressBarService{
        if(!ProgressBarService.instance){ ProgressBarService.instance = new ProgressBarService(); }
        return ProgressBarService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();

        this._progression$ = new BehaviorSubject<number>(0);
        this._visible$ = new BehaviorSubject<boolean>(false);

        this.progression$.subscribe(progression => this.setSystemProgression(progression));
    }

    private setSystemProgression(progression: number){
        this.ipcService.sendLazy("window.progression", {args: progression});
    }

    public subscribreTo(obs: Observable<number>){
        if(this.subscription){ this.unsubscribe(); }
        this.subscription = obs.pipe(distinctUntilChanged()).subscribe(value => {
            this.progression$.next(value);
        });
    }

    public unsubscribe(){
        this._progression$.next(0);
        this.subscription && this.subscription.unsubscribe();
        this.subscription = null;
    }

    public show(obs?: Observable<number>, unsubscribe? : boolean){
        if(unsubscribe){ this.unsubscribe(); }
        if(obs){ this.subscribreTo(obs); }
        this.visible$.next(true); 
    }

    public showFake(speed: number): void{
        const obs = timer(1000, 100).pipe(map(val => {
            if(this.progression$.value >= 100){ return 100; }
            const currentProgress = speed * (val + 1);
            return Math.round(Math.atan(currentProgress) / (Math.PI / 2) * 100 * 1000) / 1000;
        }));
        this.show(obs, true);
    }

    public complete(): void{
        this.progression$.next(100);
    }

    public hide(unsubscribe: boolean){
        if(unsubscribe){ this.unsubscribe(); } 
        this.visible$.next(false); 
    }

    public get progression$(): BehaviorSubject<number>{ return this._progression$; }
    public get visible$(): BehaviorSubject<boolean>{ return this._visible$; }





}