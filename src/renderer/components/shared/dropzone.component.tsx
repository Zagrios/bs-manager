import { AnimatePresence, motion } from "framer-motion";
import { DragEvent, ReactNode, useCallback, useState } from "react";
import { BsmImage } from "./bsm-image.component";
import BeatImpatient from "../../../../assets/images/apngs/beat-impatient.png";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import Color from "color";

type Props = Readonly<{
    children?: ReactNode;
    className?: string;
    text?: string;
    subtext?: string;
    onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}>;

// Supports drop and drop functionality for files.
export function Dropzone({
    children,
    className,
    text,
    subtext,
    onDrop,
}: Props) {

    const [dragCount, setDragCount] = useState(0);
    const [dropZoneDragging, setDropZoneDragging] = useState(false);
    const themeColor = useThemeColor("first-color");
    const color = new Color(themeColor).lighten(.25).saturate(.8).hex();

    const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragCount(0);
        if (onDrop) onDrop(event);
    }, []);

    const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const onDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragCount(prev => prev + 1);
    }, []);

    const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragCount(prev => prev - 1);
    }, []);

    return (
        <div className={className} onDragEnter={onDragEnter} onDragLeave={onDragLeave}>
            <AnimatePresence>
                {dragCount ? (
                    <div onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDragLeave} className="absolute size-full top-0 right-0 z-10">
                    <motion.div className="absolute size-full top-0 right-0 bg-black" initial={{ opacity: 0 }} animate={{ opacity: .6 }} exit={{ opacity: 0 }}/>
                    <motion.div className="absolute size-full top-0 right-0 flex justify-center items-center p-5" initial={{ y: "100%" }} animate={{ y: "0" }} exit={{ y: "100%" }}>
                        <div className="h-72 max-h-full w-full max-w-lg sm:h-96 sm:max-w-2xl bg-theme-3 rounded-md shadow-black shadow-lg p-7">
                            <div
                                onDragOver={onDragOver}
                                onDrop={handleDrop}
                                onDragEnter={() => setDropZoneDragging(true)}
                                onDragLeave={() => setDropZoneDragging(false)}
                                className="relative size-full z-[1] border-dashed border-3 rounded-md flex flex-col gap-1 justify-center items-center"
                                style={{ borderColor: color }}
                            >
                                <div className="absolute size-full top-0 right-0 pointer-events-none -z-[1] transition-opacity duration-150" style={{
                                    backgroundColor: "transparent",
                                    backgroundImage: `radial-gradient(${color} 1px, transparent 0)`,
                                    backgroundSize: "60px 60px",
                                    backgroundPosition: "5px",
                                    opacity: dropZoneDragging ? .7 : .2,
                                }}/>
                                <BsmImage className="size-28 pointer-events-none" image={BeatImpatient}/>
                                <span className="text-2xl font-bold pointer-events-none">{text}</span>
                                <span className="pointer-events-none">{subtext}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
                ): undefined}
            </AnimatePresence>
            {children}
        </div>
    );
}
