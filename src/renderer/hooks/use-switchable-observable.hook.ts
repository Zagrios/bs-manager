import { Observable } from "rxjs";
import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { noop } from "shared/helpers/function.helpers";

export function useSwitchableObservable<T>(observable?: Observable<T>, clearOnSwitch = true): [T, Dispatch<SetStateAction<Observable<T>>>, Observable<T>, Dispatch<SetStateAction<T>>] {
    const [currentObs, setCurrentObs] = useState(observable);
    const [obsValue, setObsValue] = useState<T>();

    useEffect(() => {
        if (!currentObs) {
            return noop;
        }
        if (clearOnSwitch) {
            setObsValue(() => null);
        }
        const sub = currentObs.subscribe(val => setObsValue(() => val));
        return () => {
            sub.unsubscribe();
        };
    }, [currentObs]);

    return [obsValue, setCurrentObs, currentObs, setObsValue];
}
