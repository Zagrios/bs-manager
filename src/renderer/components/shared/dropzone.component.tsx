import { AnimatePresence, motion } from "framer-motion";
import { DragEvent, ReactNode, useCallback, useMemo, useState } from "react";
import { BsmImage } from "./bsm-image.component";
import BeatImpatient from "../../../../assets/images/apngs/beat-impatient.png";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import Color from "color";
import { cn } from "renderer/helpers/css-class.helpers";
import { CloseIcon } from "../svgs/icons/close-icon.component";
import { OpenDialogOptions } from "electron";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { IpcService } from "renderer/services/ipc.service";
import { NotificationService } from "renderer/services/notification.service";
import { lastValueFrom } from "rxjs";

type Props = Readonly<{
    children?: ReactNode;
    className?: string;
    open?: boolean;
    text?: string;
    subtext?: string;
    onFiles?: (paths: string[]) => void;
    onClose?: () => void;
    filters?: OpenDialogOptions["filters"];
    dialogOptions?: {
        text?: string;
        dialog?: Exclude<OpenDialogOptions, "filters">;
    }
}>;

// Supports drop and drop functionality for files.
export function Dropzone({
    children,
    className,
    open,
    text,
    subtext,
    filters,
    dialogOptions,
    onFiles,
    onClose
}: Props) {

    const ipc = useService(IpcService);
    const notification = useService(NotificationService);

    const t = useTranslation();

    const [dragCount, setDragCount] = useState(0);
    const [dropZoneDragging, setDropZoneDragging] = useState(false);
    const themeColor = useThemeColor("first-color");
    const color = new Color(themeColor).lighten(.25).saturate(.8).hex();

    const supportedExtensions = useMemo(() => {
        if(!filters?.length) {
            return [];
        }

        return filters.flatMap(filter => filter.extensions ?? []);
    }, [filters]);

    const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();

        setDragCount(() => 0);
        setDropZoneDragging(() => false);

        if (!onFiles || !event.dataTransfer?.files?.length) {
            return;
        }

        const paths = Array.from(event.dataTransfer.files).reduce<string[]>((acc, file) => {
            const path = window.electron.webUtils.getPathForFile(file);

            if(supportedExtensions.some(ext => path.endsWith(ext))) {
                acc.push(path);
            }

            return acc;
        }, []);

        if(!paths.length) {
            notification.notifyError({
                title: t("notifications.shared.errors.titles.file-not-supported"),
                desc: t("notifications.shared.errors.msg.file-not-supported", { types: supportedExtensions.join(", ") }),
                duration: 8000
            });
            return;
        }

        onFiles(paths);
    }, [supportedExtensions]);

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

    const openDialog = useCallback(async () => {
        if(!dialogOptions?.dialog) {
            return;
        }

        const res = await lastValueFrom(ipc.sendV2("open-dialog", { ...dialogOptions.dialog, filters }));

        if(res?.canceled || !res?.filePaths?.length) {
            return;
        }

        onFiles?.(res.filePaths);
    }, []);

    return (
        <div className={cn("relative", className)} onDragEnter={onDragEnter} onDragLeave={onDragLeave}>
            <AnimatePresence>
                {(dragCount || open) ? (
                    <div onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDragLeave} className="absolute size-full top-0 right-0 z-10">
                    <motion.div className="absolute size-full top-0 right-0 bg-black" initial={{ opacity: 0 }} animate={{ opacity: .6 }} exit={{ opacity: 0 }}/>
                    <motion.div className="absolute size-full top-0 right-0 flex justify-center items-center p-5" initial={{ y: "100%" }} animate={{ y: "0" }} exit={{ y: "100%" }}>
                        <div className="relative h-72 max-h-full w-full max-w-lg sm:h-96 sm:max-w-2xl bg-theme-3 rounded-md shadow-black shadow-lg p-7">
                            {onClose && (
                                <button className="absolute top-0.5 right-0.5 size-7" onClick={onClose}>
                                    <CloseIcon className="size-full"/>
                                </button>
                            )}
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
                                {dialogOptions?.dialog && (
                                    <button className="underline hover:no-underline" onClick={openDialog}>{dialogOptions?.text ?? t("drop-zone.or-browse-files")}</button>
                                )}
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
