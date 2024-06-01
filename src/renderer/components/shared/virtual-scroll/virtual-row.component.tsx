import { CSSProperties } from "react";
import { cn } from "renderer/helpers/css-class.helpers";
import { typedMemo } from "renderer/helpers/typed-memo";

type Props<T> = {
    className?: string;
    style?: CSSProperties;
    items: T[];
    renderItem: (item: T) => JSX.Element;
}

function VirtualRowComponent<T>({ className, style, items, renderItem }: Props<T>) {

    return (
        <ul className={cn("h-fit w-full flex flex-nowrap", className)} style={style}>
            {items?.map((item) => (
                renderItem(item)
            ))}
        </ul>
    );
}

export const VirtualRow = typedMemo(VirtualRowComponent);
