import { Key, useCallback, useLayoutEffect, useRef, useState } from "react";
import { ListChildComponentProps, ListOnScrollProps, VariableSizeList } from "react-window";
import { cn } from "renderer/helpers/css-class.helpers";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { VirtualRow } from "./virtual-row.component";
import { splitIntoChunk } from "shared/helpers/array.helpers";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { BehaviorSubject, debounceTime, distinctUntilChanged } from "rxjs";
import { useObservable } from "renderer/hooks/use-observable.hook";

export type VirtualScrollClassNames = {
    mainDiv?: string;
    variableList?: string;
    rows?: string;
}

export type VirtualScrollEndHandler = {
    onScrollEnd: () => void;
    margin?: number;
}

type Props<T = unknown> = {
    className?: string;
    classNames?: VirtualScrollClassNames;
    minItemWidth?: number;
    maxColumns: number;
    minColumns?: number;
    itemHeight: number;
    items: T[];
    renderItem: (item: T) => JSX.Element;
    rowKey?: (rowItems: T[]) => Key;
    scrollEnd?: VirtualScrollEndHandler;
}

export function VirtualScroll<T = unknown>({ className, classNames, minItemWidth, maxColumns, minColumns, itemHeight, items, scrollEnd, renderItem, rowKey}: Props<T>) {

    const ref = useRef(null);
    const listRef = useRef<HTMLDivElement>(null);

    const [itemPerRow, setItemPerRow] = useState(1);
    const [itemsToRender, setItemsToRender] = useState<T[][]>([]);
    const listHeight$ = useConstant(() => new BehaviorSubject<number>(0));
    const listHeight = useObservable(() => listHeight$.pipe(distinctUntilChanged(), debounceTime(100)), 0);

    useLayoutEffect(() => {
        const updateItemPerRow = (listWidth: number) => {
            if (!listWidth) return;

            const calculatedColumns = Math.floor(listWidth / (minItemWidth ?? 1));
            const newColumns = Math.max((minColumns || 1), Math.min(maxColumns, calculatedColumns));
            setItemPerRow(() => newColumns);
        };

        const observer = new ResizeObserver(() => {
            updateItemPerRow(ref.current?.clientWidth || 0);
            listHeight$.next(ref.current?.clientHeight || 0);
        });

        observer.observe(ref.current);

        return () => observer.disconnect();
    }, [minItemWidth, maxColumns]);

    useOnUpdate(() => {
        const splitedItems = splitIntoChunk(items, itemPerRow);
        setItemsToRender(() => splitedItems);

    }, [itemPerRow, items])

    const handleScroll = (e: ListOnScrollProps) => {
        if(!scrollEnd?.onScrollEnd || !listRef.current){ return; }

        const { scrollDirection, scrollOffset, scrollUpdateWasRequested } = e;
        const { scrollHeight } = listRef.current;

        if(!scrollHeight || !listHeight){ return; }

        const margin = scrollEnd.margin ?? 0;

        if (scrollDirection === "forward" && !scrollUpdateWasRequested && scrollOffset + listHeight + margin >= scrollHeight) {
            scrollEnd.onScrollEnd();
        }
    };

    const renderRow = useCallback((props: ListChildComponentProps<any>) => {
        return <VirtualRow items={props.data[props.index]} renderItem={renderItem} className={classNames?.rows} style={props.style}/>;
    }, [renderItem, classNames?.rows]);

    return (
        <div ref={ref} className={cn(className, classNames?.mainDiv)}>
            <VariableSizeList
                innerRef={listRef}
                className={cn("scrollbar-default", classNames?.variableList)}
                width="100%" height={listHeight}
                layout="vertical"
                itemCount={itemsToRender.length}
                itemKey={i => rowKey?.(itemsToRender[i]) ?? i}
                itemSize={() => itemHeight}
                itemData={itemsToRender}
                style={{ scrollbarGutter: "stable both-edges" }}
                onScroll={handleScroll}
            >
                {renderRow}
            </VariableSizeList>
        </div>
    )
}
