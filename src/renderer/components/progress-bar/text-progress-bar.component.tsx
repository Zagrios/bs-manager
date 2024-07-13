import { CSSProperties } from "react";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { Observable, map } from "rxjs";

type Props = {
    value$: Observable<number | string>;
    className?: string;
    style?: CSSProperties;
};

export default function TextProgressBar({ value$, className, style }: Props) {
    const value = useObservable(() => value$.pipe(map(v => Math.round(Number(v)))));

    const prefix = typeof value === "number" ? "%" : "";

    return <span className={className} style={style}>{`${value}${prefix}`}</span>;
}
