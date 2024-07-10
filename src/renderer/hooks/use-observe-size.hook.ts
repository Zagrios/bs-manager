import { RefObject, useEffect } from "react";
import { useConstant } from "./use-constant.hook";
import { BehaviorSubject, debounceTime, distinctUntilChanged } from "rxjs";
import { useObservable } from "./use-observable.hook";

type Props = {
    ref: RefObject<HTMLElement>;
    deps?: unknown[];
    debounce?: number;
}

export function useObserveSize(opt: Props): { width: number; height: number } {

    const size$ = useConstant(() => new BehaviorSubject({ width: 0, height: 0 }));
    const size = useObservable(() => size$.pipe(debounceTime(opt.debounce ?? 0), distinctUntilChanged()), { width: 0, height: 0 });

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            size$.next({ width: entry.contentRect.width, height: entry.contentRect.height });
        });

        if (opt.ref?.current) {
            observer.observe(opt?.ref?.current);
        }

        return () => {
            observer.disconnect();
        };
    }, opt.deps ?? []);

    return size;
}
