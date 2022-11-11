import { BsmImage } from "../shared/bsm-image.component";
import { BsvMapCharacteristic, BsvMapDifficultyType } from "shared/models/maps/beat-saver.model"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { BsmLink } from "../shared/bsm-link.component";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { BsmButton } from "../shared/bsm-button.component";
import { motion } from "framer-motion";
import { useState } from "react";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import dateFormat from "dateformat";
import { AudioPlayerService } from "renderer/services/audio-player.service";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { map } from "rxjs/operators";

export type MapItemProps = {
    hash: string,
    title: string,
    autor: string,
    songAutor: string,
    coverUrl: string,
    songUrl: string,
    autorId: number,
    mapId: string,
    diffs: Map<BsvMapCharacteristic, BsvMapDifficultyType[]>,
    qualified: boolean,
    ranked: boolean,
    bpm: number,
    duration: number,
    likes: number,
    createdAt: string,
    onDelete?: (hash: string) => void,
    onDownload?: (id: string) => void,
}

export function MapItem({hash, title, autor, songAutor, coverUrl, songUrl, autorId, mapId, diffs, qualified, ranked, bpm, duration, likes, createdAt, onDelete, onDownload}: MapItemProps) {

    const linkOpener = LinkOpenerService.getInstance();
    const audioPlayer = AudioPlayerService.getInstance();

    const color = useThemeColor("first-color");

    const [hovered, setHovered] = useState(false);

    const songPlaying = useObservable(audioPlayer.playing$.pipe(map(playing => playing && audioPlayer.src === songUrl ? true : false)));

    const zipUrl = `https://r2cdn.beatsaver.com/${hash}.zip`;
    const previewUrl = `https://skystudioapps.com/bs-viewer/?url=${zipUrl}`;
    const mapUrl = mapId ? `https://beatsaver.com/maps/${mapId}` : null;
    const authorUrl = autorId ? `https://beatsaver.com/profile/${autorId}` : null;
    const createdDate = createdAt ? dateFormat(createdAt, "d mmm yyyy") : null;
    const likesText = likes ? Intl.NumberFormat(undefined, {notation: "compact"}).format(likes).split(" ").join("") : null;

    const durationText = (() => {
        if(!duration){ return null; }
        const date = new Date(0);
        date.setSeconds(duration);
        return duration > 3600 ? dateFormat(date, "h:MM:ss") : dateFormat(date, "MM:ss");
    })()

    console.log(hash);

    const openMapPage = () => {
        if(mapUrl){
            linkOpener.open(mapUrl)
        }
    }

    const openPreview = () => linkOpener.open(previewUrl, true);
    const copyBsr = () => navigator.clipboard.writeText(`!bsr ${mapId}`);
    const toogleMusic = () => {
        if(songPlaying){
            return audioPlayer.pause();
        }
        if(!audioPlayer.playing && audioPlayer.src === songUrl){
            return audioPlayer.resume();
        }
        audioPlayer.play(songUrl, bpm);
    }
    
    return (
        <motion.li className="h-[100px] min-w-[400px] shrink grow basis-0 text-white group cursor-pointer" onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} onClick={openMapPage}>
            <div className="h-full w-full relative pl-[100px] rounded-md overflow-hidden flex flex-row justify-end">
                <div className="absolute top-0 left-0 h-full aspect-square">
                    <BsmImage image={coverUrl}/>
                    <span className="absolute flex justify-center items-center w-full h-full pr-1 bg-transparent top-0 left-0 group-hover:bg-black group-hover:bg-opacity-40" style={{color}} onClick={(e) => {e.stopPropagation(); toogleMusic()}}>
                        <BsmIcon className="w-full h-full p-7 opacity-0 group-hover:opacity-100 text-white hover:text-current" icon="play"/>
                    </span>
                </div>
                <div className="h-full w-full z-[1] relative rounded-md overflow-hidden -translate-x-1">
                    <BsmImage className="absolute w-full h-full object-cover" image={coverUrl}/>
                    <div className="absolute py-1 pl-2 pr-7 top-0 left-0 w-full h-full bg-gray-600 bg-opacity-80 flex flex-col group-hover:bg-main-color-1 group-hover:bg-opacity-80">
                        <h1 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full leading-5 tracking-wide text-lg">{title}</h1>
                        <h2 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full text-sm mb-[3px]">par {songAutor}</h2>
                        <h3 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full text-xs">mappée par <BsmLink href={authorUrl} className="brightness-150 saturate-50 hover:underline" style={{color}}>{autor}</BsmLink></h3>
                        <div className="w-full h-[15px] text-xs gap-2 hidden group-hover:flex">
                            {likesText && (
                                <div className="h-full flex items-center">
                                    <BsmIcon className="h-[12px] w-fit shrink-0 mr-1" icon="trash"/>
                                    <span className="mb-[2px]">{likesText}</span>
                                </div>
                            )}
                            {durationText && (
                                <div className="h-full flex items-center">
                                    <BsmIcon className="h-[12px] w-fit shrink-0 mr-1" icon="trash"/>
                                    <span className="mb-[2px]">{durationText}</span>
                                </div>
                            )}
                            {createdAt && (
                                <div className="h-full flex items-center">
                                    <BsmIcon className="h-[12px] w-fit shrink-0 mr-1" icon="trash"/>
                                    <time className="mb-[2px]">{createdDate}</time>
                                </div>
                            )}
                        </div>
                    </div> 
                </div>
                <motion.div className="absolute bg-main-color-3 top-0 right-0 h-full z-[1]" initial={{width: "8px"}} animate={{width: hovered ? "30px" : "8px"}}>
                    <span className="absolute w-[10px] h-[10px] top-0 right-full bg-inherit" style={{clipPath: 'path("M11 -1 L11 10 L10 10 A10 10 0 0 0 0 0 L0 -1 Z")'}}/>
                    <span className="absolute w-[10px] h-[10px] bottom-0 right-full bg-inherit" style={{clipPath: 'path("M11 11 L11 0 L10 0 A10 10 0 0 1 0 10 L 0 11 Z")'}}/>

                    <div className="flex flex-col justify-center items-center gap-1 w-full h-full overflow-hidden transition-opacity" style={{opacity: hovered ? 1 : 0}}>
                        {onDelete && <BsmButton className="w-6 h-6 p-[2px] rounded-md !bg-inherit hover:!bg-main-color-2" iconClassName="w-full h-full brightness-150 saturate-50" iconColor={color} icon="trash" withBar={false} onClick={e => {e.stopPropagation(); openPreview()}}/>}
                        <BsmButton className="w-6 h-6 p-[2px] rounded-md !bg-inherit hover:!bg-main-color-2" iconClassName="w-full h-full brightness-150 saturate-50" iconColor={color} icon="eye" withBar={false} onClick={e => {e.stopPropagation(); openPreview()}}/>
                        {mapId && <BsmButton className="w-6 h-6 p-1 rounded-md !bg-inherit hover:!bg-main-color-2" iconClassName="w-full h-full brightness-150 saturate-50" iconColor={color} icon="twitch" withBar={false} onClick={e => {e.stopPropagation(); copyBsr()}}/>}
                    </div>
                </motion.div>
            </div>
            
        </motion.li>
    )
}

const diffColors: Record<BsvMapDifficultyType, string> = {
    Easy: "#008055",
    Normal: "#1268a1",
    Hard: "#bd5500",
    Expert: "#b52a1c",
    ExpertPlus: "#7646af"
}
