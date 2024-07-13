/* eslint-disable no-nested-ternary */
import { motion } from 'framer-motion';
import { BsmImage } from 'renderer/components/shared/bsm-image.component';
import { ClockIcon } from 'renderer/components/svgs/icons/clock-icon.component';
import { MapIcon } from 'renderer/components/svgs/icons/map-icon.component';
import { PersonIcon } from 'renderer/components/svgs/icons/person-icon.component';
import { useThemeColor } from 'renderer/hooks/use-theme-color.hook';
import dateFormat from 'dateformat';
import { NpsIcon } from 'renderer/components/svgs/icons/nps-icon.component';
import { GlowEffect } from 'renderer/components/shared/glow-effect.component';
import { memo, useState } from 'react';
import { SearchIcon } from 'renderer/components/svgs/icons/search-icon.component';
import { BsmButton } from 'renderer/components/shared/bsm-button.component';
import Tippy from '@tippyjs/react';
import { Observable, of } from 'rxjs';
import { useObservable } from 'renderer/hooks/use-observable.hook';
import { BsmBasicSpinner } from 'renderer/components/shared/bsm-basic-spinner/bsm-basic-spinner.component';
import defaultImage from "../../../../../assets/images/default-version-img.jpg";
import equal from 'fast-deep-equal';
import { useTranslation } from 'renderer/hooks/use-translation.hook';

export type PlaylistItemComponentProps = {
    title?: string;
    author?: string;
    coverBase64?: string;
    coverUrl?: string;
    nbMaps?: number;
    nbMappers?: number;
    duration?: number;
    minNps?: number;
    maxNps?: number;
    selected$?: Observable<boolean>;
    isDownloading$?: Observable<boolean>;
    isInQueue$?: Observable<boolean>;
    onClick?: () => void;
    onClickOpen?: () => void;
    onClickOpenFile?: () => void;
    onClickDelete?: () => void;
    onClickSync?: () => void;
    onClickDownload?: () => void;
    onClickCancelDownload?: () => void;
    onClickEdit?: () => void;
}

export const PlaylistItem = memo(({ title,
    author,
    coverUrl,
    coverBase64,
    duration,
    nbMaps,
    nbMappers,
    minNps,
    maxNps,
    selected$,
    isDownloading$,
    isInQueue$,
    onClick,
    onClickOpen,
    onClickOpenFile,
    onClickSync,
    onClickDownload,
    onClickDelete,
    onClickCancelDownload,
    onClickEdit
}: PlaylistItemComponentProps) => {

    const t = useTranslation();
    const color = useThemeColor("first-color");

    const [hovered, setHovered] = useState(false);
    const selected = useObservable(() => selected$ ?? of(false), false, [selected$]);
    const isDownloading = useObservable(() => isDownloading$ ?? of(), false, [isDownloading$]);
    const isInQueue = useObservable(() => isInQueue$ ?? of(), false, [isInQueue$]);

    const nbMapsText = nbMaps ? Intl.NumberFormat(undefined, { notation: "compact" }).format(nbMaps).trim() : null;
    const nbMappersText = nbMappers ? Intl.NumberFormat(undefined, { notation: "compact" }).format(nbMappers).trim() : null;
    const minNpsText = minNps ? Math.round(minNps * 10) / 10 : 0;
    const maxNpsText = maxNps ? Math.round(maxNps * 10) / 10 : 0;
    const showNps = minNps !== undefined && maxNps !== undefined;

    const durationText = (() => {
        if (!duration) {
            return null;
        }
        return duration > 3600 ? dateFormat(duration * 1000, "h:MM:ss") : dateFormat(duration * 1000, "MM:ss");
    })();

    return (
        <motion.li className='relative flex-grow basis-0 min-w-80 h-28 cursor-pointer group' onHoverStart={() => setHovered(() => true)} onHoverEnd={() => setHovered(() => false)}>
            <GlowEffect visible={selected || hovered}/>
            <div className="size-full relative flex flex-row justify-start items-center overflow-hidden bg-black rounded-md *:z-[1]" onClick={e => {e.stopPropagation(); onClick?.()}}>
                <div className="absolute inset-0 flex justify-center items-center z-0">
                    <BsmImage className="size-full object-cover saturate-150 blur-lg" image={coverUrl} base64={coverBase64} />
                    <div className="absolute inset-0 bg-black opacity-20"/>
                </div>
                <div className="relative h-full aspect-square p-2.5" style={{ color }}>
                    <BsmImage className="size-full flex-shrink-0 object-cover rounded-md shadow-center shadow-black bg-main-color-1" image={coverUrl} base64={coverBase64} placeholder={defaultImage} errorImage={defaultImage} style={{filter: hovered && "brightness(75%)"}} />
                    <SearchIcon
                        className="absolute size-full top-0 left-0 p-7 opacity-0 text-white hover:text-current group-hover:opacity-100 transition-opacity"
                        onClick={e => {e.stopPropagation(); onClickOpen?.()}}
                    />
                </div>
                <div className="h-full py-2.5 text-white">
                    <h1 className="font-bold text-xl tracking-wide line-clamp-1 w-fit">{title}</h1>
                    <p className="text-xs font-bold">{t("playlist.created-by")} <span className="brightness-200" style={{color}}>{author}</span></p>

                    <div className="flex flex-row flex-wrap w-full gap-2 mt-1">
                        { nbMapsText && <div className="flex items-center text-sm h-5 gap-0.5"> <MapIcon className='h-full aspect-square'/> <span className="mb-0.5">{nbMapsText}</span> </div> }
                        { nbMappersText && <div className="flex items-center text-sm h-5 gap-0.5"> <PersonIcon className='h-full aspect-square'/> <span className="mb-0.5">{nbMappersText}</span> </div> }
                        { durationText && <div className="flex items-center text-sm h-5 gap-0.5"> <ClockIcon className='h-full aspect-square'/> <span className="mb-0.5">{durationText}</span> </div> }
                        { showNps && <div className="flex items-center text-sm h-5 gap-0.5"> <NpsIcon className='h-full aspect-square scale-95'/> <span className="mb-0.5">{`${minNpsText} - ${maxNpsText}`}</span> </div> }
                    </div>

                </div>
                <motion.div className="absolute bg-theme-3 top-0 h-full w-max left-full" animate={{x: (hovered || isDownloading ? "-100%" : "-0.625rem")}} transition={{duration: .1}} onClick={e => e.stopPropagation()}>
                    <span className="absolute size-2.5 top-0 right-full bg-inherit translate-x-px" style={{ clipPath: 'path("M11 -1 L11 10 L10 10 A10 10 0 0 0 0 0 L0 -1 Z")' }} />
                    <span className="absolute size-2.5 bottom-0 right-full bg-inherit translate-x-px" style={{ clipPath: 'path("M11 11 L11 0 L10 0 A10 10 0 0 1 0 10 L 0 11 Z")' }} />

                    <motion.div className="flex flex-col justify-center items-center flex-wrap gap-0.5 size-full px-1 *:size-6 *:!bg-inherit *:p-0.5 *:rounded-md" animate={{opacity: hovered || isDownloading ? 1 : 0}} transition={{duration: 0}}>
                        {(isDownloading || isInQueue) && onClickCancelDownload ? (
                            <Tippy content={isDownloading ? t("playlist.stop-download") : t("playlist.cancel-download")} placement="left" theme="default">
                                <BsmButton
                                    icon="close"
                                    className="hover:!bg-main-color-1 text-red-500 !p-0"
                                    iconClassName="size-full"
                                    onClick={onClickCancelDownload}
                                    withBar={false}
                                />
                            </Tippy>
                        ) : (undefined)}
                        {onClickSync ? (
                            isDownloading ? (
                                <BsmBasicSpinner className="hover:!bg-main-color-1" spinnerClassName="brightness-75 dark:brightness-200" style={{ color }} thikness="3px"/>
                            ) : !isInQueue ? (
                                <Tippy content={t("playlist.synchronize-playlist")} placement="left" theme="default">
                                    <BsmButton
                                        icon="sync"
                                        className="hover:!bg-main-color-1"
                                        iconClassName="size-full brightness-75 dark:brightness-200"
                                        style={{color}}
                                        onClick={onClickSync}
                                        withBar={false}
                                    />
                                </Tippy>
                            ) : undefined

                        ) : undefined}
                        {onClickDownload ? (
                            isDownloading ? (
                                <BsmBasicSpinner className="hover:!bg-main-color-1" spinnerClassName="brightness-75 dark:brightness-200" style={{ color }} thikness="3px"/>
                            ) : !isInQueue ? (
                                <Tippy content={t("playlist.download-playlist")} placement="left" theme="default">
                                    <BsmButton
                                        icon="download"
                                        className="hover:!bg-main-color-1"
                                        iconClassName="size-full brightness-75 dark:brightness-200"
                                        style={{color}}
                                        onClick={onClickDownload}
                                        withBar={false}
                                    />
                                </Tippy>
                            ) : undefined

                        ) : undefined}
                        {onClickEdit ? (
                            <Tippy content={t("playlist.edit-playlist")} placement="left" theme="default">
                                <BsmButton
                                    icon="edit"
                                    className="hover:!bg-main-color-1"
                                    iconClassName="size-full brightness-75 dark:brightness-200"
                                    style={{color}}
                                    onClick={onClickEdit}
                                    withBar={false}
                                />
                            </Tippy>
                        ) : undefined}
                        {onClickOpenFile ? <Tippy content={t("playlist.open-file")} placement="left" theme="default">
                            <BsmButton
                                icon="folder"
                                className="hover:!bg-main-color-1"
                                iconClassName="size-full brightness-75 dark:brightness-200"
                                style={{color}}
                                onClick={onClickOpenFile}
                                withBar={false}
                            />
                        </Tippy> : undefined}
                        {(onClickDelete && !isDownloading && !isInQueue) ? <Tippy content={t("misc.delete")} placement="left" theme="default">
                            <BsmButton
                                icon="trash"
                                className="hover:!bg-main-color-1 text-red-500"
                                iconClassName="size-full"
                                onClick={onClickDelete}
                                withBar={false}
                            />
                        </Tippy> : undefined}
                    </motion.div>
                </motion.div>
            </div>
        </motion.li>

    )
}, equal);
