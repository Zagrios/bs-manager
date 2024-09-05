import React, { ReactNode, useState } from "react";

type Props = Readonly<{
    children?: ReactNode;
    className?: string;
    overlay?: ReactNode;
    overlayColor?: string;
    overlayZIndex?: number;
    onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
}>;

// Supports drop and drop functionality for files.
export function Dropzone({
    children,
    className,
    overlay,
    overlayColor,
    overlayZIndex,
    onDrop
}: Props) {

    const [dragging, setDragging] = useState(false);

    const normalizeZIndex = (zIndex?: number) => {
        return (!zIndex || zIndex <= 0) ? 50 : zIndex;
    }

    const renderFileOverlay = () => {
        return (
            <div
                className="absolute w-full h-full flex items-center justify-center"
                style={{
                    backgroundColor: overlayColor || "#000000CC",
                    zIndex: normalizeZIndex(overlayZIndex),
                }}
                onDrop={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDragging(false);
                    if (onDrop) onDrop(event);
                }}
                onDragOver={event => {
                    event.preventDefault();
                    event.stopPropagation();
                }}
                onDragEnter={event => {
                    // Should consume the event 1 more time to avoid multiple onDragEnter
                    //   triggers by the parent div
                    event.preventDefault();
                    event.stopPropagation();
                }}
                onDragLeave={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDragging(false);
                }}
            >
                {overlay}
            </div>
        )
    }

    return (
        <div className={className} onDragEnter={event => {
            event.preventDefault();
            event.stopPropagation();
            setDragging(true);
        }}>
            {dragging && renderFileOverlay()}
            {children}
        </div>
    );
}
