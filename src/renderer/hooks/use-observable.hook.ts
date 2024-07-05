import { Observable } from "rxjs";
import { useState, useEffect } from "react";

export function useObservable<T>(factory: () => Observable<T>, initValue?: T, deps?: unknown[]): T {
    const [obsValue, setObsValue] = useState<T>(initValue);

    useEffect(() => {
        const sub = factory().subscribe(val => setObsValue(val));
        return () => sub.unsubscribe();
    }, deps ?? []);

    return obsValue;
}
