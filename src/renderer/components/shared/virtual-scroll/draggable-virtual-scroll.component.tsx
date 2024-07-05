import { CSSProperties, useCallback, useRef } from "react";
import { DragDropContext, Draggable, DraggableProvided, DropResult, Droppable } from "react-beautiful-dnd";
import { ListChildComponentProps, VariableSizeList } from "react-window";
import { cn } from "renderer/helpers/css-class.helpers";
import { useObserveSize } from "renderer/hooks/use-observe-size.hook";
import equal from "fast-deep-equal";
import { typedMemo } from "renderer/helpers/typed-memo";

type DraggableVirtualScrollClassNames = {
    mainDiv?: string;
    variableList?: string;
    rows?: string;
}

type Props<T = unknown> = {
    className?: string;
    classNames?: DraggableVirtualScrollClassNames;
    itemHeight: number;
    items: T[];
    isDragDisabled?: boolean;
    renderItem: (item: T) => JSX.Element;
    onDragEnd?: (fromIndex: number, toIndex: number) => void;
}

export function DraggableVirtualScroll<T = unknown>({
    className,
    classNames,
    items,
    itemHeight,
    isDragDisabled,
    renderItem,
    onDragEnd
}: Props<T>) {

    const ref = useRef(null);
    const { height } = useObserveSize({ ref, debounce: 100 });

    const handleOnDragEnd = useCallback((result: DropResult) => {
        if(!onDragEnd){ return; }
        if (!result.destination || result.destination.index === result.source.index) { return; }
        onDragEnd(result.source.index, result.destination.index);
    }, [onDragEnd]);

    const renderDraggedItem = useCallback((renderItem: (item: T) => JSX.Element, itemProps: T, provided: DraggableProvided) => {
        return (
            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}  className={cn("list-none outline-none", classNames?.rows)}>
                {renderItem(itemProps)}
            </div>
        )
    }, [renderItem]);

    const renderRow = useCallback((props: ListChildComponentProps<T[]>) => {
        return (
            <DraggableRow
                item={props.data[props.index]}
                renderItem={renderItem}
                index={props.index}
                className={classNames?.rows}
                style={props.style}
                isDragDisabled={isDragDisabled}
            />
        )
    }, [renderItem, isDragDisabled]);

    return (
        <div ref={ref} className={cn(className, classNames?.mainDiv)}>
            <DragDropContext onDragEnd={handleOnDragEnd}>
                <Droppable droppableId="idtemp" mode="virtual" renderClone={(provided, _, rubric) => {
                    return renderDraggedItem(renderItem, items[rubric.source.index], provided)
                }}>
                    {provided => (
                        <VariableSizeList
                            outerRef={provided.innerRef}
                            className={cn("scrollbar-default", classNames?.variableList)}
                            width="100%" height={height}
                            layout="vertical"
                            itemCount={items.length}
                            itemSize={() => itemHeight}
                            itemData={items}
                            style={{ scrollbarGutter: "stable both-edges" }}
                            direction="vertical"
                        >
                            {renderRow}
                        </VariableSizeList>
                    )}
                </Droppable>
            </DragDropContext>
        </div>
    )
}

type DraggableRowProps<T = unknown> = {
    className?: string;
    style?: CSSProperties;
    item: T;
    index: number;
    isDragDisabled?: boolean;
    renderItem: (item: T) => JSX.Element;
}

function DraggableRowComponent<T>({ item, renderItem, className, style, index, isDragDisabled }: DraggableRowProps<T>) {

    const innerRender = useCallback((provided: DraggableProvided) => {
        return (
            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={cn("list-none outline-none", className)} style={{ ...style, ...provided.draggableProps.style }}>
                {renderItem(item)}
            </div>
        )
    }, [item]);

    return (
        <Draggable draggableId={index.toString()} index={index} isDragDisabled={isDragDisabled}>
            {innerRender}
        </Draggable>
    )

}

const DraggableRow = typedMemo(DraggableRowComponent, equal);
