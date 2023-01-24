import { useState } from "react";
import { BehaviorSubject } from "rxjs";
import { useObservable } from "./use-observable.hook";

export function useBehaviorSubject<T>(value: T): [T, BehaviorSubject<T>]{
    const [subject] = useState(new BehaviorSubject(value));
    const subjectValue = useObservable(subject);
    
    return [subjectValue, subject];
}