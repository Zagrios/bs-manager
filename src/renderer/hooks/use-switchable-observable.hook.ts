import { Observable } from "rxjs";
import { useState, useEffect, Dispatch, SetStateAction } from "react";

export function useSwitchableObservable<T>(observable?: Observable<T>, clearOnSwitch = true): [T, React.Dispatch<React.SetStateAction<Observable<T>>>, Observable<T>, Dispatch<SetStateAction<T>>] {
    const [currentObs, setCurrentObs] = useState(observable);
    const [obsValue, setObsValue] = useState<T>();

    useEffect(() => {
        if (!currentObs) {
            return;
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
