import { Observable } from "rxjs";
import { useState, useEffect } from "react";

export function useObservable<T>(observable: Observable<T>, defaultValue?: T): T{
    const [obsValue, setObsValue] = useState(defaultValue ?? null as T);

    useEffect(() => {
      const sub = observable.subscribe(val => setObsValue(() => val));
      return () => sub.unsubscribe();
    }, [])
    
    return obsValue;
}