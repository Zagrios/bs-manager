import { BsmImage } from "../shared/bsm-image.component";
import { BsvMapCharacteristic, BsvMapDifficultyType } from "shared/models/maps/beat-saver.model"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { BsmLink } from "../shared/bsm-link.component";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { BsmButton } from "../shared/bsm-button.component";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import dateFormat from "dateformat";
import { AudioPlayerService } from "renderer/services/audio-player.service";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { map } from "rxjs/operators";

export type ParsedMapDiff = {type: BsvMapDifficultyType, name: string, stars: number}

export type MapItemProps = {
    hash: string,
    title: string,
    autor: string,
    songAutor: string,
    coverUrl: string,
    songUrl: string,
    autorId: number,
    mapId: string,
    diffs: Map<BsvMapCharacteristic, ParsedMapDiff[]>,
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
    const [bottomBarHovered, setBottomBarHovered] = useState(false);
    const [diffsPanelHovered, setDiffsPanelHoverd] = useState(false);

    const songPlaying = useObservable(audioPlayer.playing$.pipe(map(playing => playing && audioPlayer.src === songUrl)));

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

    console.log(bottomBarHovered, diffsPanelHovered);

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

    const renderDiffPreview = () => {

        const diffSets = Array.from(diffs.entries());

        if(diffSets.length === 1){
            const [diffType, diffSet] = diffSets[0];
            
            return (
                <>
                    <BsmIcon className="h-4 w-4 mr-px" icon="bsMapDifficulty"/>
                    <div className="flex py-[2px] gap-[1px] h-full">
                        {diffSet.map(diff => (
                            <span key={diff.type} className="h-full w-[6px] brightness-200 saturate-150 rounded-full" style={{backgroundColor: diffColors[diff.type]}}/>
                        ))}
                    </div>
                </>
            )
        }
        if(diffSets.length > 1){
            return diffSets.map(([diffType, diffSet]) => (
                <>
                    <BsmIcon className="h-full w-fit mr-px" icon={diffType}/>
                    <span className="mr-2 font-bold text-[15px] h-full flex items-center pb-px">{diffSet.length}</span>
                </>
            ));
        }
    }

    console.log(coverUrl);
    
    return (
        <motion.li className="relative h-[100px] min-w-[400px] shrink grow basis-0 text-white group" onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} style={{zIndex: (bottomBarHovered || diffsPanelHovered) && 5}}>
            <AnimatePresence>
                {(diffsPanelHovered || bottomBarHovered) && (
                    <motion.div className="absolute w-full top-[calc(100%-10px)] h-fit bg-main-color-3 brightness-125 rounded-md pointer-events-auto" onHoverStart={() => setDiffsPanelHoverd(true)} onHoverEnd={() => setDiffsPanelHoverd(false)}>
                        aaeaze<br/>azeaze
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="h-full w-full relative pl-[100px] rounded-md overflow-hidden flex flex-row justify-end">
                <div className="absolute top-0 left-0 h-full aspect-square">
                    <BsmImage image={coverUrl}/>
                    <span className="absolute flex justify-center items-center w-full h-full pr-1 bg-transparent top-0 left-0 group-hover:bg-black group-hover:bg-opacity-40" style={{color}} onClick={(e) => {e.stopPropagation(); toogleMusic()}}>
                        <BsmIcon className="w-full h-full p-7 opacity-0 group-hover:opacity-100 text-white hover:text-current" icon={songPlaying ? "pause" : "play"}/>
                    </span>
                </div>
                <div className="h-full w-full z-[1] rounded-md overflow-hidden -translate-x-1" style={{backgroundImage: `url('${coverUrl}')`, backgroundPosition: "center", backgroundSize: "cover"}}>
                    <div className="pt-1 pl-2 pr-7 top-0 left-0 w-full h-full bg-gray-600 bg-opacity-80 flex flex-col justify-between group-hover:bg-main-color-1 group-hover:bg-opacity-80">
                        <h1 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full leading-5 tracking-wide text-lg"><BsmLink className="hover:underline" href={mapUrl}>{title}</BsmLink></h1>
                        <h2 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full text-sm mb-[3px]">par {songAutor}</h2>
                        <h3 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full text-xs">{autor && (<> mappée par <BsmLink href={authorUrl} className="brightness-150 saturate-50 hover:underline" style={{color}}>{autor}</BsmLink></>)}</h3>
                        <div className="w-full h-4 text-xs gap-2 flex opacity-0 group-hover:opacity-100">
                            {likesText && (
                                <div className="h-full flex items-center">
                                    <BsmIcon className="h-full py-[2px] w-fit shrink-0 mr-1" icon="thumbUpFill"/>
                                    <span className="mb-[2px]">{likesText}</span>
                                </div>
                            )}
                            {durationText && (
                                <div className="h-full flex items-center">
                                    <BsmIcon className="h-full py-[2px] w-fit shrink-0 mr-1" icon="timerFill"/>
                                    <span className="mb-[2px]">{durationText}</span>
                                </div>
                            )}
                            {createdAt && (
                                <div className="h-full flex items-center">
                                    <BsmIcon className="h-full py-[2px] w-fit shrink-0 mr-1" icon="checkCircleIcon"/>
                                    <time className="mb-[2px]">{createdDate}</time>
                                </div>
                            )}
                        </div>
                        <motion.div className="w-full h-5 pb-1 pr-7 flex items-center gap-1" onHoverStart={() => setBottomBarHovered(true)} onHoverEnd={() => setBottomBarHovered(false)}>
                            <div className="text-yellow-300 bg-current rounded-full px-1 h-full flex items-center justify-center">
                                <span className="uppercase text-xs font-bold tracking-wide brightness-[.25]">classée</span>
                            </div>
                            <div className="h-full grow flex items-start content-start">
                                {renderDiffPreview()}
                            </div>
                        </motion.div>
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
