import { CSSProperties, memo } from "react";
import { cn } from "renderer/helpers/css-class.helpers";

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

const typedMemo: <T, P>(c: T, propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean) => T = memo;

export const VirtualRow = typedMemo(VirtualRowComponent);
