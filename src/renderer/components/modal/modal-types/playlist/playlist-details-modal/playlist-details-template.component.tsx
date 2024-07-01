import { ReactNode } from "react"
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import dateFormat from "dateformat";
import { MapIcon } from "renderer/components/svgs/icons/map-icon.component";
import { PersonIcon } from "renderer/components/svgs/icons/person-icon.component";
import { ClockIcon } from "renderer/components/svgs/icons/clock-icon.component";
import { NpsIcon } from "renderer/components/svgs/icons/nps-icon.component";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { ThemeColorGradientSpliter } from "renderer/components/shared/theme-color-gradient-spliter.component";
import { CrossIcon } from "renderer/components/svgs/icons/cross-icon.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export type PlaylistDetailsTemplateProps = {
    title: string;
    imagebase64?: string;
    imageUrl?: string;
    author: string;
    description: string;
    nbMaps: number;
    duration: number;
    nbMappers: number;
    minNps: number;
    maxNps: number;
    children?: ReactNode;
    onClose?: () => void;
}

export function PlaylistDetailsTemplate({title, imagebase64, imageUrl, author, description, nbMaps, duration, nbMappers, minNps, maxNps, children, onClose}: PlaylistDetailsTemplateProps) {

    const t = useTranslation();
    const color = useThemeColor("first-color");

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

    return (
        <div className="flex flex-col w-screen max-w-2xl h-screen max-h-[calc(100vh-1.25rem)] translate-y-2.5 bg-theme-1 rounded-t-lg overflow-hidden">
            <header className="shrink-0 relative h-36 overflow-hidden flex flex-row p-3">
                <button className="absolute top-2 right-2 z-[1]" onClickCapture={onClose}>
                    <CrossIcon className="size-3.5 text-gray-200"/>
                </button>
                <BsmImage className="absolute top-0 left-0 size-full object-cover blur-xl scale-150 brightness-75 saturate-200" base64={imagebase64} image={imageUrl}/>
                <BsmImage className="h-full aspect-square object-cover z-[1] rounded-md shadow-black shadow-center" base64={imagebase64} image={imageUrl}/>
                <div className="h-full px-3 text-white z-[1]">
                    <h1 className="font-bold text-xl tracking-wide line-clamp-1 w-fit">{title}</h1>
                    <p className="line-clamp-2" title={description}>{description}</p>
                    <p className="text-xs font-bold">{t("playlist.created-by")} <span className="brightness-200" style={{color}}>{author}</span></p>

                    <div className="flex flex-row flex-wrap w-full gap-2 mt-1">
                        { nbMapsText && <div className="flex items-center text-sm h-5 gap-0.5"> <MapIcon className='h-full aspect-square'/> <span className="mb-0.5">{nbMapsText}</span> </div> }
                        { nbMappersText && <div className="flex items-center text-sm h-5 gap-0.5"> <PersonIcon className='h-full aspect-square'/> <span className="mb-0.5">{nbMappersText}</span> </div> }
                        { durationText && <div className="flex items-center text-sm h-5 gap-0.5"> <ClockIcon className='h-full aspect-square'/> <span className="mb-0.5">{durationText}</span> </div> }
                        { showNps && <div className="flex items-center text-sm h-5 gap-0.5"> <NpsIcon className='h-full aspect-square scale-95'/> <span className="mb-0.5">{`${minNpsText} - ${maxNpsText}`}</span> </div> }
                    </div>

                </div>
            </header>
            <ThemeColorGradientSpliter className="shrink-0 w-full h-0.5"/>
            {children}
        </div>
    )
}
