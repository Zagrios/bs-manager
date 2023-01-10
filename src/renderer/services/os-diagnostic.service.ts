import { BehaviorSubject } from "rxjs";

export class OsDiagnosticService {

    private static instance: OsDiagnosticService;

    public static getInstance(): OsDiagnosticService{
        if(!OsDiagnosticService.instance){ OsDiagnosticService.instance = new OsDiagnosticService(); }
        return OsDiagnosticService.instance;
    }

    private _isOnline$ = new BehaviorSubject(navigator.onLine);

    private constructor(){

        window.addEventListener("online", () => this._isOnline$.next(true));
        window.addEventListener("offline", () => this._isOnline$.next(false));

    }

    public get isOnline(){ return this._isOnline$.value; }
    public get isOffline(){ return !this._isOnline$.value; }
    public get isOnline$(){ return this._isOnline$.asObservable(); }

}