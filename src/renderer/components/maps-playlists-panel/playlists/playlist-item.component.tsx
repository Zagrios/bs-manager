import { motion } from 'framer-motion';
import { BsmImage } from 'renderer/components/shared/bsm-image.component';
import { ClockIcon } from 'renderer/components/svgs/icons/clock-icon.component';
import { MapIcon } from 'renderer/components/svgs/icons/map-icon.component';
import { PersonIcon } from 'renderer/components/svgs/icons/person-icon.component';
import { useThemeColor } from 'renderer/hooks/use-theme-color.hook';
import dateFormat from 'dateformat';
import { NpsIcon } from 'renderer/components/svgs/icons/nps-icon.component';
import { useService } from 'renderer/hooks/use-service.hook';
import { AudioPlayerService } from 'renderer/services/audio-player.service';
import { filter, lastValueFrom, skip, take } from 'rxjs';

type Props = {
    id: string;
    className?: string;
    title?: string;
    author?: string;
    coverBase64?: string;
    coverUrl?: string;
    nbMaps?: number;
    nbMappers?: number;
    duration?: number;
    minNps?: number;
    maxNps?: number;
    songs?: { url: string, bpm: number }[];
}

export function PlaylistItem({ id, className, title, author, coverUrl, coverBase64, duration, nbMaps, nbMappers, minNps, maxNps, songs }: Props) {

    const player = useService(AudioPlayerService);

    const firstColor = useThemeColor("first-color");

    const nbMapsText = nbMaps ? Intl.NumberFormat(undefined, { notation: "compact" }).format(nbMaps).trim() : null;
    const nbMappersText = nbMappers ? Intl.NumberFormat(undefined, { notation: "compact" }).format(nbMappers).trim() : null;
    const minNpsText = minNps ? Math.round(minNps * 10) / 10 : null;
    const maxNpsText = maxNps ? Math.round(maxNps * 10) / 10 : null;

    const durationText = (() => {
        if (!duration) {
            return null;
        }
        const date = new Date(0);
        date.setSeconds(duration);
        return duration > 3600 ? dateFormat(date, "h:MM:ss") : dateFormat(date, "MM:ss");
    })();

    const startPlay = async () => {
        if (!songs || songs.length === 0) {
            return;
        }
        const playlist = songs.map(s => ({ src: s.url, bpm: s.bpm }));
        player.playlist(playlist, 0);
    }

    return (
        <motion.li id={id} layoutId={id} className={`relative flex flex-row justify-start items-center flex-grow basis-0 min-w-80 h-28 cursor-pointer rounded-md overflow-hidden ${className}`} onClick={() => startPlay()}>
            <div className="absolute top-0 left-0 size-full flex justify-center items-center -z-[1]">
                <BsmImage className="size-full object-cover scale-[2] saturate-150 blur-xl" image={coverUrl} base64={coverBase64} loading="lazy" />
                <div className="absolute top-0 left-0 size-full bg-black opacity-15"/>
            </div>
            <div className="h-full aspect-square p-2.5">
                <BsmImage className="size-full flex-shrink-0 object-cover rounded-md shadow-center shadow-black bg-main-color-1" image={coverUrl} base64={coverBase64} loading="lazy" />
            </div>
            <div className="h-full py-2.5 text-white">
                <h1 className="font-bold text-lg capitalize tracking-wide line-clamp-1">{title}</h1>
                <p className="text-xs font-bold">Créé par <span className="brightness-200" style={{color: firstColor}}>{author}</span></p>

                <div className="flex flex-row flex-wrap w-full gap-2 mt-1">
                    { nbMapsText && <div className="flex items-center text-sm h-5 gap-0.5"> <MapIcon className='h-full aspect-square'/> <span className="mb-0.5">{nbMapsText}</span> </div> }
                    { nbMappersText && <div className="flex items-center text-sm h-5 gap-0.5"> <PersonIcon className='h-full aspect-square'/> <span className="mb-0.5">{nbMappersText}</span> </div> }
                    { durationText && <div className="flex items-center text-sm h-5 gap-0.5"> <ClockIcon className='h-full aspect-square'/> <span className="mb-0.5">{durationText}</span> </div> }
                    { (minNps && maxNps) && <div className="flex items-center text-sm h-5 gap-0.5"> <NpsIcon className='h-full aspect-square scale-95'/> <span className="mb-0.5">{`${minNpsText} - ${maxNpsText}`}</span> </div> }
                </div>

            </div>
        </motion.li>
    )
}
