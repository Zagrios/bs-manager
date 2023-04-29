import { useEffect, EffectCallback, DependencyList } from "react";

export function useOnUpdate(func: EffectCallback, deps: DependencyList = []) {
    useEffect(() => {
        func();
    }, deps);
}
