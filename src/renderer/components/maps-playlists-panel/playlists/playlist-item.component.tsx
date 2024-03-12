import { motion } from 'framer-motion';
import { BsmImage } from 'renderer/components/shared/bsm-image.component';
import { ClockIcon } from 'renderer/components/svgs/icons/clock-icon.component';
import { MapIcon } from 'renderer/components/svgs/icons/map-icon.component';
import { PersonIcon } from 'renderer/components/svgs/icons/person-icon.component';
import { useThemeColor } from 'renderer/hooks/use-theme-color.hook';
import dateFormat from 'dateformat';
import { NpsIcon } from 'renderer/components/svgs/icons/nps-icon.component';
import { GlowEffect } from 'renderer/components/shared/glow-effect.component';
import { useState } from 'react';
import { SearchIcon } from 'renderer/components/svgs/icons/search-icon.component';
import { BsmButton } from 'renderer/components/shared/bsm-button.component';
import Tippy from '@tippyjs/react';

type Props = {
    title?: string;
    author?: string;
    coverBase64?: string;
    coverUrl?: string;
    nbMaps?: number;
    nbMappers?: number;
    duration?: number;
    minNps?: number;
    maxNps?: number;
    selected?: boolean;
    path?: string;
    onClickOpen?: () => void;
    onClickOpenFile?: () => void;
    onClickDelete?: () => void;
    onClickSync?: () => void;
}

export function PlaylistItem({ title,
    author,
    coverUrl,
    coverBase64,
    duration,
    nbMaps,
    nbMappers,
    minNps,
    maxNps,
    selected,
    onClickOpen,
    onClickOpenFile,
    onClickSync,
    onClickDelete
}: Props) {

    const color = useThemeColor("first-color");

    const [hovered, setHovered] = useState(false);

    const nbMapsText = nbMaps ? Intl.NumberFormat(undefined, { notation: "compact" }).format(nbMaps).trim() : null;
    const nbMappersText = nbMappers ? Intl.NumberFormat(undefined, { notation: "compact" }).format(nbMappers).trim() : null;
    const minNpsText = minNps ? Math.round(minNps * 10) / 10 : 0;
    const maxNpsText = maxNps ? Math.round(maxNps * 10) / 10 : 0;
    const showNps = minNps !== undefined && maxNps !== undefined;

    const durationText = (() => {
        if (!duration) {
            return null;
        }
        const date = new Date(0);
        date.setSeconds(duration);
        return duration > 3600 ? dateFormat(date, "h:MM:ss") : dateFormat(date, "MM:ss");
    })();

    // TODO : Translate

    return (
        <motion.li className='relative flex-grow basis-0 min-w-80 h-28 cursor-pointer group' onHoverStart={() => setHovered(() => true)} onHoverEnd={() => setHovered(() => false)} >
            <GlowEffect visible={selected || hovered}/>
            <div className="size-full relative flex flex-row justify-start items-center overflow-hidden rounded-md">
                <div className="absolute inset-0 flex justify-center items-center -z-[1]">
                    <BsmImage className="size-full object-cover saturate-150 blur-lg" image={coverUrl} base64={coverBase64} />
                    <div className="absolute inset-0 bg-black opacity-20"/>
                </div>
                <div className="relative h-full aspect-square p-2.5" style={{ color }}>
                    <BsmImage className="size-full flex-shrink-0 object-cover rounded-md shadow-center shadow-black bg-main-color-1" image={coverUrl} base64={coverBase64} style={{filter: hovered && "brightness(75%)"}} />
                    <SearchIcon
                        className="absolute size-full top-0 left-0 p-7 opacity-0 text-white hover:text-current group-hover:opacity-100 transition-opacity"
                        onClick={onClickOpen}
                    />
                </div>
                <div className="h-full py-2.5 text-white">
                    <h1 className="font-bold text-xl tracking-wide line-clamp-1 w-fit">{title}</h1>
                    <p className="text-xs font-bold">Créé par <span className="brightness-200" style={{color}}>{author}</span></p>

                    <div className="flex flex-row flex-wrap w-full gap-2 mt-1">
                        { nbMapsText && <div className="flex items-center text-sm h-5 gap-0.5"> <MapIcon className='h-full aspect-square'/> <span className="mb-0.5">{nbMapsText}</span> </div> }
                        { nbMappersText && <div className="flex items-center text-sm h-5 gap-0.5"> <PersonIcon className='h-full aspect-square'/> <span className="mb-0.5">{nbMappersText}</span> </div> }
                        { durationText && <div className="flex items-center text-sm h-5 gap-0.5"> <ClockIcon className='h-full aspect-square'/> <span className="mb-0.5">{durationText}</span> </div> }
                        { showNps && <div className="flex items-center text-sm h-5 gap-0.5"> <NpsIcon className='h-full aspect-square scale-95'/> <span className="mb-0.5">{`${minNpsText} - ${maxNpsText}`}</span> </div> }
                    </div>

                </div>
                <div className="absolute bg-light-main-color-3 dark:bg-main-color-3 top-0 h-full w-max left-full -translate-x-2.5 group-hover:-translate-x-full transition-transform">
                    <span className="absolute size-2.5 top-0 right-full bg-inherit translate-x-px" style={{ clipPath: 'path("M11 -1 L11 10 L10 10 A10 10 0 0 0 0 0 L0 -1 Z")' }} />
                    <span className="absolute size-2.5 bottom-0 right-full bg-inherit translate-x-px" style={{ clipPath: 'path("M11 11 L11 0 L10 0 A10 10 0 0 1 0 10 L 0 11 Z")' }} />

                    <div className="flex flex-col justify-center items-center flex-wrap gap-0.5 opacity-0 size-full px-1 group-hover:opacity-100 *:size-6 *:!bg-inherit *:p-0.5 *:rounded-md">
                        {onClickSync && <Tippy content="Synchronizer la playlist" placement="left" theme="default">
                            <BsmButton
                                icon="sync"
                                className="hover:!bg-main-color-1"
                                iconClassName="size-full brightness-75 dark:brightness-200"
                                style={{color}}
                                onClick={onClickSync}
                                withBar={false}
                            />
                        </Tippy>}
                        {onClickOpenFile && <Tippy content="Afficher le fichier" placement="left" theme="default">
                            <BsmButton
                                icon="folder"
                                className="hover:!bg-main-color-1"
                                iconClassName="size-full brightness-75 dark:brightness-200"
                                style={{color}}
                                onClick={onClickOpenFile}
                                withBar={false}
                            />
                        </Tippy>}
                        {onClickDelete && <Tippy content="Supprimer" placement="left" theme="default">
                            <BsmButton
                                icon="trash"
                                className="hover:!bg-main-color-1 text-red-500"
                                iconClassName="size-full"
                                onClick={onClickDelete}
                                withBar={false}
                            />
                        </Tippy>}

                    </div>
                </div>
            </div>
        </motion.li>

    )
}
