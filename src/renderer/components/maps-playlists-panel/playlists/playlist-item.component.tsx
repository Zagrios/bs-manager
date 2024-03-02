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
    onClickOpen?: () => void;
}

export function PlaylistItem({ title, author, coverUrl, coverBase64, duration, nbMaps, nbMappers, minNps, maxNps, selected, onClickOpen }: Props) {

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
        <motion.li className='relative flex-grow basis-0 min-w-80 h-28 cursor-pointer' onHoverStart={() => setHovered(() => true)} onHoverEnd={() => setHovered(() => false)} >
            <GlowEffect visible={selected || hovered}/>
            <div className="size-full relative flex flex-row justify-start items-center overflow-hidden rounded-md">
                <div className="absolute top-0 left-0 size-full flex justify-center items-center -z-[1]">
                    <BsmImage className="size-full object-cover scale-150 saturate-150 blur-lg" image={coverUrl} base64={coverBase64} />
                    <div className="absolute top-0 left-0 size-full bg-black opacity-15"/>
                </div>
                <div className="relative h-full aspect-square p-2.5" style={{ color }}>
                    <BsmImage className="size-full flex-shrink-0 object-cover rounded-md shadow-center shadow-black bg-main-color-1" image={coverUrl} base64={coverBase64} style={{filter: hovered && "brightness(75%)"}} />
                    <SearchIcon
                        className="absolute size-1/2 top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 transition-opacity duration-150 text-white hover:text-current"
                        style={{ opacity: hovered ? 1 : 0}}
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
            </div>
        </motion.li>

    )
}
