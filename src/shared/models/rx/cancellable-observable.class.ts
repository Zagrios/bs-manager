import { BehaviorSubject, Observable, Observer, filter, lastValueFrom, take } from "rxjs";

export class CancellableObservable<T> extends Observable<T> {
    
    private readonly _isCancelled$ = new BehaviorSubject(false);

    constructor(subscriber: (obs: CancellableObserver<T>) => void) {

        super((observer: Observer<T>) => {

            const cancellableObserver: CancellableObserver<T> = Object.assign(observer, { 
                $isCancelled: () => this.$isCancelled(),
                onCancel: (callback: () => void) => this.onCancel(callback)
            });

            subscriber(cancellableObserver);
        });

        lastValueFrom(this).finally(() => this._isCancelled$.complete());
    }

    public cancel(): void {
        this._isCancelled$.next(true);
    }

    public onCancel(callback: () => void): void {
        this.$isCancelled().pipe(filter(isCancelled => isCancelled), take(1)).subscribe(callback);
    }

    public $isCancelled(): Observable<boolean> {
        return this._isCancelled$.asObservable();
    }

    public isCancelled(): boolean {
        return this._isCancelled$.getValue();
    }
}

export interface CancellableObserver<T> extends Observer<T> {
    readonly $isCancelled: () => Observable<boolean>;
    readonly onCancel: (callback: () => void) => void;
}