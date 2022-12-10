import { BsmImage } from "../shared/bsm-image.component";
import { BsvMapCharacteristic, BsvMapDifficultyType } from "shared/models/maps/beat-saver.model"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { BsmLink } from "../shared/bsm-link.component";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { BsmButton } from "../shared/bsm-button.component";
import { AnimatePresence, motion } from "framer-motion";
import { useState, Fragment, memo } from "react";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import dateFormat from "dateformat";
import { AudioPlayerService } from "renderer/services/audio-player.service";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { map } from "rxjs/operators";
import useDelayedState from "use-delayed-state";
import { v4 as uuidv4 } from 'uuid';
import equal from "fast-deep-equal/es6";
import { getMapZipUrlFromHash } from "renderer/helpers/maps-utils";
import { BsmBasicSpinner } from "../shared/bsm-basic-spinner/bsm-basic-spinner.component";
import defaultImage from '../../../../assets/images/default-version-img.jpg'

export type ParsedMapDiff = {type: BsvMapDifficultyType, name: string, stars: number}

export type MapItemProps<T = any> = {
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
    selected?: boolean,
    downloading?: boolean,
    callBackParam: T
    onDelete?: (param: T) => void,
    onDownload?: (param: T) => void,
    onSelected?: (param: T) => void,
    onCancelDownload?: (param: T) => void
}

export const MapItem = memo(({hash, title, autor, songAutor, coverUrl, songUrl, autorId, mapId, diffs, qualified, ranked, bpm, duration, likes, createdAt, selected, downloading, callBackParam, onDelete, onDownload, onSelected, onCancelDownload}: MapItemProps) => {

    const linkOpener = LinkOpenerService.getInstance();
    const audioPlayer = AudioPlayerService.getInstance();

    const color = useThemeColor("first-color");

    const [hovered, setHovered] = useState(false);
    const [bottomBarHovered, setBottomBarHovered, cancelBottomBarHovered] = useDelayedState(false);
    const [diffsPanelHovered, setDiffsPanelHovered] = useState(false);

    const songPlaying = useObservable(audioPlayer.playing$.pipe(map(playing => playing && audioPlayer.src === songUrl)));

    const zipUrl = getMapZipUrlFromHash(hash);
    const previewUrl = mapId ? `https://skystudioapps.com/bs-viewer/?url=${zipUrl}` : null;
    const mapUrl = mapId ? `https://beatsaver.com/maps/${mapId}` : null;
    const authorUrl = autorId ? `https://beatsaver.com/profile/${autorId}` : null;
    const createdDate = createdAt ? dateFormat(createdAt, "d mmm yyyy") : null;
    const likesText = likes ? Intl.NumberFormat(undefined, {notation: "compact"}).format(likes).split(" ").join("") : null;

    const durationText = (() => {
        if(!duration){ return null; }
        const date = new Date(0);
        date.setSeconds(duration);
        return duration > 3600 ? dateFormat(date, "h:MM:ss") : dateFormat(date, "MM:ss");
    })();

    const parseDiffLabel = (diffLabel: string) => {
        if(diffLabel === "ExpertPlus"){ return "Expert+" }
        return diffLabel;
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

    const bottomBarHoverStart = () => {
        cancelBottomBarHovered();
        setBottomBarHovered(true, (diffsPanelHovered || bottomBarHovered) ? 0 : 300);
    }

    const bottomBarHoverEnd = () => {
        cancelBottomBarHovered();
        setBottomBarHovered(false, 100);
    }

    const diffsPanelHoverStart = () => setDiffsPanelHovered(true);
    const diffsPanelHoverEnd = () => setDiffsPanelHovered(false);
    

    const renderDiffPreview = () => {

        const diffSets = Array.from(diffs.entries());

        if(diffSets.length === 1){
            const [diffType, diffSet] = diffSets[0];
            
            return (
                <>
                    <BsmIcon className="h-4 w-4 mr-px" icon="bsMapDifficulty"/>
                    <div className="flex py-[2px] gap-[1px] h-full">
                        {diffSet.map(diff => (
                            <span key={diff.type} className="h-full w-[6px] rounded-full" style={{backgroundColor: diffColors[diff.type]}}/>
                        ))}
                    </div>
                </>
            )
        }
        if(diffSets.length > 1){
            return diffSets.map(([diffType, diffSet]) => (
                <Fragment key={uuidv4()}>
                    <BsmIcon className="h-full w-fit mr-px" icon={diffType}/>
                    <span className="mr-2 font-bold text-[15px] h-full flex items-center pb-px">{diffSet.length}</span>
                </Fragment>
            ));
        }
    }
    
    return (
        <motion.li className="relative h-[100px] min-w-[370px] shrink-0 grow basis-0 text-white group cursor-pointer" onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} style={{zIndex: hovered && 5, transform: "translateZ(0) scale(1.0, 1.0)", backfaceVisibility: "hidden"}} onClick={e => {onSelected?.(callBackParam)}}>
            {(hovered || selected) && onSelected && <motion.span className="glow-on-hover !transition-none" animate={{opacity: 1}} transition={{duration: .2, ease: "linear"}}/>}
            <AnimatePresence>
                {(diffsPanelHovered || bottomBarHovered) && (
                    <motion.ul key={hash} className="absolute top-[calc(100%-10px)] w-full h-fit max-h-[200%] pt-4 pb-2 px-2 overflow-y-scroll bg-main-color-3 brightness-125 rounded-md flex flex-col gap-3 scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900 shadow-sm shadow-black" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: .15}} onHoverStart={diffsPanelHoverStart} onHoverEnd={diffsPanelHoverEnd}>
                        {Array.from(diffs.entries()).map(([charac, diffSet]) => (
                            <ol key={uuidv4()} className="flex flex-col w-full gap-1">
                                {diffSet.map(({type, name, stars}) => (
                                    <li key={`${type}${name}${stars}`} className="w-full h-4 flex items-center gap-1">
                                        <BsmIcon className="h-full w-fit p-px" icon={charac}/>
                                        <span className="h-full px-2 flex items-center text-xs font-bold bg-current rounded-full" style={{color: diffColors[type]}}>
                                            {
                                                stars ? (
                                                    <span className="h-full block brightness-[.25]">★ {stars}</span>
                                                ) : (
                                                    <span className="h-full brightness-[.25] leading-4 pb-[2px]">{parseDiffLabel(type)}</span>
                                                )
                                            }
                                        </span>
                                        <span className="text-sm leading-4 pb-[2px]">{parseDiffLabel(name)}</span>
                                    </li>
                                ))}
                            </ol>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
            <div className="h-full w-full relative pl-[100px] rounded-md overflow-hidden flex flex-row justify-end">
                <div className="absolute top-0 left-0 h-full aspect-square cursor-pointer">
                    <BsmImage className="w-full h-full object-cover" image={coverUrl} placeholder={defaultImage} errorImage={defaultImage} loading="lazy"/>
                    <span className="absolute flex justify-center items-center w-full h-full pr-1 bg-transparent top-0 left-0 group-hover:bg-black group-hover:bg-opacity-40" style={{color}} onClick={(e) => {e.stopPropagation(); toogleMusic()}}>
                        <BsmIcon className="w-full h-full p-7 opacity-0 group-hover:opacity-100 text-white hover:text-current" icon={songPlaying ? "pause" : "play"}/>
                    </span>
                </div>
                <div className="relative h-full w-full z-[1] rounded-md overflow-hidden -translate-x-1">
                    <BsmImage className="absolute top-0 left-0 w-full h-full -z-[1] object-cover" image={coverUrl} placeholder={defaultImage} errorImage={defaultImage} loading="lazy"/>
                    <div className="pt-1 pl-2 pr-7 top-0 left-0 w-full h-full bg-gray-600 bg-opacity-80 flex flex-col justify-between group-hover:bg-main-color-1 group-hover:bg-opacity-80">
                        <h1 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full leading-5 tracking-wide text-lg" title={title}><BsmLink className="hover:underline" href={mapUrl}>{title}</BsmLink></h1>
                        <h2 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full text-sm mb-[3px]">par {songAutor}</h2>
                        <h3 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full text-xs">{autor && (<> mappée par <BsmLink href={authorUrl} className="brightness-150 hover:underline" style={{color}}>{autor}</BsmLink></>)}</h3>
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
                        <motion.div className="w-full h-5 pb-1 pr-7 flex items-center gap-1" onHoverStart={bottomBarHoverStart} onHoverEnd={bottomBarHoverEnd}>
                            {ranked && (
                                <div className="text-yellow-300 bg-current rounded-full px-1 h-full flex items-center justify-center">
                                    <span className="uppercase text-xs font-bold tracking-wide brightness-[.25]">classée</span>
                                </div>
                            )}
                            <div className="h-full grow flex items-start content-start">
                                {renderDiffPreview()}
                            </div>
                        </motion.div>
                    </div> 
                </div>
                <div className="absolute bg-main-color-3 top-0 h-full z-[1] w-[30px] -right-5 group-hover:right-0 transition-all">
                    <span className="absolute w-[10px] h-[10px] top-0 right-full bg-inherit" style={{clipPath: 'path("M11 -1 L11 10 L10 10 A10 10 0 0 0 0 0 L0 -1 Z")'}}/>
                    <span className="absolute w-[10px] h-[10px] bottom-0 right-full bg-inherit" style={{clipPath: 'path("M11 11 L11 0 L10 0 A10 10 0 0 1 0 10 L 0 11 Z")'}}/>

                    <div className="flex flex-col justify-center items-center gap-1 w-full h-full overflow-hidden opacity-0 group-hover:opacity-100">
                        {onDelete && !downloading && <BsmButton className="w-6 h-6 p-[2px] rounded-md !bg-inherit hover:!bg-main-color-2" iconClassName="w-full h-full brightness-150" iconColor={color} icon="trash" withBar={false} onClick={e => {e.stopPropagation(); onDelete(callBackParam)}}/>}
                        {onDownload && !downloading && <BsmButton className="w-6 h-6 p-[2px] rounded-md !bg-inherit hover:!bg-main-color-2" iconClassName="w-full h-full brightness-150" iconColor={color} icon="download" withBar={false} onClick={e => {e.stopPropagation(); onDownload(callBackParam)}}/>}
                        {onCancelDownload && !downloading && <BsmButton className="w-6 h-6 p-1 rounded-md !bg-inherit hover:!bg-main-color-2" iconClassName="w-full h-full brightness-150" iconColor={"red"} icon="cross" withBar={false} onClick={e => {e.stopPropagation(); onCancelDownload(callBackParam)}}/>}
                        {downloading && <BsmBasicSpinner className="w-6 h-6 p-1 rounded-md !bg-inherit hover:!bg-main-color-2 flex items-center justify-center" spinnerClassName="brightness-150" style={{color}} thikness="3px"/>}
                        {previewUrl && <BsmButton className="w-6 h-6 p-[2px] rounded-md !bg-inherit hover:!bg-main-color-2" iconClassName="w-full h-full brightness-150" iconColor={color} icon="eye" withBar={false} onClick={e => {e.stopPropagation(); openPreview()}}/>}
                        {mapId && <BsmButton className="w-6 h-6 p-1 rounded-md !bg-inherit hover:!bg-main-color-2" iconClassName="w-full h-full brightness-150" iconColor={color} icon="twitch" withBar={false} onClick={e => {e.stopPropagation(); copyBsr()}}/>}
                    </div>
                </div>
            </div>
        </motion.li>
    )
}, areEqual)

function areEqual(prevProps: MapItemProps, nextProps: MapItemProps): boolean {
    return equal(prevProps, nextProps);
}

export const diffColors: Record<BsvMapDifficultyType, string> = {
    Easy: "#00FF9E",
    Normal: "#00FFFF",
    Hard: "#FFA700",
    Expert: "#FF4319",
    ExpertPlus: "#FF7EFF"
}
