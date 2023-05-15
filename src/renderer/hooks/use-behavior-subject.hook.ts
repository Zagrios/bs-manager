import { BehaviorSubject } from "rxjs";
import { useObservable } from "./use-observable.hook";
import { useConstant } from "./use-constant.hook";

export function useBehaviorSubject<T>(value: T): [T, BehaviorSubject<T>]{
    const subject$ = useConstant(() => new BehaviorSubject(value));
    const subjectValue = useObservable(subject$, value);
    
    return [subjectValue, subject$];
}