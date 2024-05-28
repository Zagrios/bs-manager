import { useLayoutEffect, useRef, useState } from "react";
import { VariableSizeList } from "react-window";
import { cn } from "renderer/helpers/css-class.helpers";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { VirtualRow } from "./virtual-row.component";
import { splitIntoChunk } from "shared/helpers/array.helpers";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { BehaviorSubject, debounceTime } from "rxjs";
import { useObservable } from "renderer/hooks/use-observable.hook";

type ClassNames = {
    mainDiv?: string;
    variableList?: string;
    rows?: string;
}

type Props<T = unknown> = {
    className?: string;
    classNames?: ClassNames;
    minItemWidth: number;
    maxColumns: number;
    minColumns?: number;
    itemHeight: number;
    items: T[];
    renderItem: (item: T) => JSX.Element;
}

export function VirtualScroll<T = unknown>({ className, classNames, minItemWidth, maxColumns, minColumns, itemHeight, items, renderItem}: Props<T>) {

    console.log("omg les classes", className);

    const ref = useRef(null);

    const [itemPerRow, setItemPerRow] = useState(1);
    const [itemsToRender, setItemsToRender] = useState<T[][]>([]);
    const listHeight$ = useConstant(() => new BehaviorSubject<number>(0));
    const listHeight = useObservable(() => listHeight$.pipe(debounceTime(100)), 0);

    useLayoutEffect(() => {
        const updateItemPerRow = (listWidth: number) => {
            if (!listWidth) return;

            const calculatedColumns = Math.floor(listWidth / minItemWidth);
            const newColumns = Math.max((minColumns || 1), Math.min(maxColumns, calculatedColumns));
            setItemPerRow(() => newColumns);
        };

        const observer = new ResizeObserver(() => {
            updateItemPerRow(ref.current?.clientWidth || 0);
            listHeight$.next(ref.current?.clientHeight || 0);
            console.log("list height", ref.current?.clientHeight);
        });

        observer.observe(ref.current);

        return () => observer.disconnect();
    }, [minItemWidth, maxColumns]);

    useOnUpdate(() => {
        const splitedItems = splitIntoChunk(items, itemPerRow);
        setItemsToRender(() => splitedItems);
    }, [itemPerRow, items])

    return (
        <div ref={ref} className={cn(className, classNames?.mainDiv)}>
            <VariableSizeList className={cn("scrollbar-default", classNames?.variableList)} width="100%" height={listHeight} layout="vertical" itemCount={itemsToRender.length} itemKey={i => i} itemSize={() => itemHeight} itemData={itemsToRender} style={{ scrollbarGutter: "stable both-edges" }}>
                {props => <VirtualRow key={props.index} items={props.data[props.index]} renderItem={renderItem} className={classNames?.rows} style={props.style}/>}
            </VariableSizeList>
        </div>
    )
}
