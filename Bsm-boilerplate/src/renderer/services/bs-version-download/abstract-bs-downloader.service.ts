import { BehaviorSubject, Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";

export abstract class AbstractBsDownloaderService {
    private static readonly __downloadingVersion$ = new BehaviorSubject<BSVersion>(null);
    private static readonly __isVerifying$ = new BehaviorSubject<boolean>(false);

    protected get _downloadingVersion$(){ return AbstractBsDownloaderService.__downloadingVersion$; }
    protected get _isVerifying$(){ return AbstractBsDownloaderService.__isVerifying$; }

    public get downloadingVersion$(): Observable<BSVersion>{ return this._downloadingVersion$.asObservable(); }
    public get downloadingVersion(): BSVersion{ return this._downloadingVersion$.getValue(); }

    public get isVerifying$(): Observable<boolean>{ return this._isVerifying$.asObservable(); }
    public get isVerifying(): boolean{ return this._isVerifying$.getValue(); }
}