import { MapFilter, MapTag } from "shared/models/maps/beat-saver.model"
import {motion} from "framer-motion"
import { MutableRefObject, useRef, useState } from "react"
import { MAP_TYPES } from "renderer/partials/map-tags/map-types"
import { MAP_STYLES } from "renderer/partials/map-tags/map-styles"
import { BsmCheckbox } from "../shared/bsm-checkbox.component"
import { diffColors } from "./map-item.component"
import { getTrackBackground, Range } from 'react-range';
import { useThemeColor } from "renderer/hooks/use-theme-color.hook"
import { getCorrectTextColor } from "renderer/helpers/correct-text-color"
import { hour_to_s, min_to_s } from "renderer/helpers/time-utils"
import dateFormat from "dateformat"

export type Props = {
    className?: string,
    ref?: MutableRefObject<undefined>
    playlist?: boolean,
    filter?: MapFilter
    onChange?: (filter: MapFilter) => void
}

export function FilterPanel({className, ref, playlist = false, filter, onChange}: Props) {

    const MIN_NPS = 0;
    const MAX_NPS = 17;

    const MIN_DURATION = 0;
    const MAX_DURATION = min_to_s(30);

    const [npss, setNpss] = useState<number[]>([filter?.minNps || MIN_NPS, filter?.maxNps || MAX_NPS]);
    const [durations, setDurations] = useState<number[]>([filter?.minDuration || MIN_DURATION, filter?.maxDuration || MAX_DURATION]);
    const firstColor = useThemeColor("first-color");
    const thumbTextColor = getCorrectTextColor(firstColor);

    const isTagEnabled = (tag: MapTag): boolean => {
        return filter?.enabledTags?.some(t => t === tag) || filter?.excludedTags?.some(t => t === tag);
    }

    const isTagExcluded = (tag: MapTag): boolean => {
        return filter?.excludedTags?.some(t => t === tag);
    }

    const secToTimer = (sec: number): string => {
        const date = new Date(0);
        date.setSeconds(sec);
        return sec > 3600 ? dateFormat(date, "h:MM:ss") : dateFormat(date, "MM:ss");
    }

    const handleRangeChange = ([min, max]: number[]) => {
        setNpss(() => [min, max]);
        onChange?.({...filter, minNps: min, maxNps: max});
    }

    const handleRangeDurationChange = ([min, max]: number[]) => {
        setDurations([min, max]);
        onChange?.({...filter, minDuration: min, maxDuration: max});
    }

    console.log(hour_to_s(2));

    return !playlist ? (
        <motion.div ref={ref} className={className} initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
            <div className="w-full h-6 grid grid-cols-2 gap-x-10 px-4 mb-5 pt-2">
                <div>
                    <Range 
                        values={npss}
                        min={MIN_NPS}
                        max={MAX_NPS}
                        step={.1}
                        onChange={handleRangeChange}
                        renderTrack={({props, children}) => (
                            <div
                                onMouseDown={props.onMouseDown}
                                onTouchStart={props.onTouchStart}
                                className="w-full rounded-full h-1"
                                {...props}
                                style={{
                                ...props.style,
                                background: getTrackBackground({
                                    values: npss,
                                    colors: ["#ccc", firstColor, "#ccc"],
                                    min: MIN_NPS,
                                    max: MAX_NPS
                                }),
                                }}
                            >
                                {children}
                            </div>
                        )}
                        renderThumb={({ index, props }) => (
                            <div
                                className="relative w-4 h-4 rounded-full shadow-center shadow-black brightness-150 flex justify-center outline-none"
                                {...props}
                                style={{
                                    ...props.style,
                                    backgroundColor: firstColor
                                }}
                            >
                                <span className={`absolute top-[calc(100%+4px)] font-bold w-8 h-5 text-center rounded-md align-middle flex justify-center items-center shadow-sm shadow-black ${npss[index] === MAX_NPS ? "text-xl" : "text-sm"}`} style={{backgroundColor: firstColor, color: thumbTextColor}}>{
                                    npss[index] === MAX_NPS ? "∞" : npss[index] === MIN_NPS ? "NPS" : npss[index].toFixed(1)
                                }</span>
                            </div>
                        )}
                    />
                </div>
                <div>
                    <Range 
                        values={durations}
                        min={MIN_DURATION}
                        max={MAX_DURATION}
                        step={5}
                        onChange={handleRangeDurationChange}
                        renderTrack={({props, children}) => (
                            <div
                                onMouseDown={props.onMouseDown}
                                onTouchStart={props.onTouchStart}
                                className="w-full rounded-full h-1"
                                {...props}
                                style={{
                                ...props.style,
                                background: getTrackBackground({
                                    values: durations,
                                    colors: ["#ccc", firstColor, "#ccc"],
                                    min: MIN_DURATION,
                                    max: MAX_DURATION
                                }),
                                }}
                            >
                                {children}
                            </div>
                        )}
                        renderThumb={({ index, props }) => (
                            <div
                                className="relative w-4 h-4 rounded-full shadow-center shadow-black brightness-150 flex justify-center outline-none"
                                {...props}
                                style={{
                                    ...props.style,
                                    backgroundColor: firstColor
                                }}
                            >
                                <span className={`absolute top-[calc(100%+4px)] font-bold min-w-[40px] h-5 text-center rounded-md align-middle flex justify-center items-center shadow-sm shadow-black ${durations[index] === MAX_DURATION ? "text-xl" : "text-sm"}`} style={{backgroundColor: firstColor, color: thumbTextColor}}>{
                                    durations[index] === MAX_DURATION ? "∞" : durations[index] === MIN_DURATION ? "Durée" : secToTimer(durations[index])
                                }</span>
                            </div>
                        )}
                    />
                </div>
            </div>
            <div className="w-full h-full flex gap-x-2">
                <section className="shrink-0">
                    <h2 className="mb-1 uppercase text-sm">general</h2>
                    <div className="flex justify-start items-center h-6 z-20 relative py-0.5">
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" disabled={filter?.automapper}/>
                        <span className="grow">AI</span>
                    </div>
                    <div className="flex justify-start items-center h-6 z-20 relative py-0.5">
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" disabled={filter?.ranked}/>
                        <span className="grow">Rancked</span>
                    </div>
                    <div className="flex justify-start items-center h-6 z-20 relative py-0.5">
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" disabled={filter?.curated}/>
                        <span className="grow">Curated</span>
                    </div>
                    <div className="flex justify-start items-center h-6 z-20 relative py-0.5">
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" disabled={filter?.verified}/>
                        <span className="grow">Verified Mapper</span>
                    </div>
                    <div className="flex justify-start items-center h-6 z-20 relative py-0.5">
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" disabled={filter?.fullSpread}/>
                        <span className="grow">Full Spread</span>
                    </div>
                    <h2 className="my-1 uppercase text-sm">requirements</h2>
                    <div className="flex justify-start items-center h-6 z-20 relative py-0.5">
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" disabled={filter?.chroma}/>
                        <span className="grow">Chroma</span>
                    </div>
                    <div className="flex justify-start items-center h-6 z-20 relative py-0.5">
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" disabled={filter?.noodle}/>
                        <span className="grow">Noodle</span>
                    </div>
                    <div className="flex justify-start items-center h-6 z-20 relative py-0.5">
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" disabled={filter?.me}/>
                        <span className="grow">Mapping Extensions</span>
                    </div>
                    <div className="flex justify-start items-center h-6 z-20 relative py-0.5">
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" disabled={filter?.cinema}/>
                        <span className="grow">Cinema</span>
                    </div>
                    
                </section>  
                <section className="grow">
                    <h2 className="uppercase text-sm mb-1">TAGS</h2>
                    <div className="w-full flex flex-row flex-wrap items-start justify-start content-start gap-1 mb-2">
                        {MAP_TYPES.map(tag => (
                            <span key={tag} className={`text-sm text-black rounded-md px-1 font-bold cursor-pointer ${(!isTagEnabled(tag)) && "opacity-40 hover:opacity-100"}`} style={{backgroundColor: isTagExcluded(tag) ? diffColors.Expert : diffColors.Normal}}>{tag}</span>
                        ))}
                    </div>
                    <div className="w-full flex flex-row flex-wrap items-start justify-start content-start gap-1">
                        {MAP_STYLES.map(tag => (
                            <span key={tag} className={`text-sm text-black rounded-md px-1 font-bold cursor-pointer ${(!isTagEnabled(tag)) && "opacity-40 hover:opacity-100"}`} style={{backgroundColor: isTagExcluded(tag) ? diffColors.Expert : diffColors.Easy}}>{tag}</span>
                        ))}
                    </div>
                    
                    
                </section>
            </div>
        </motion.div>
    ) : (
    <></>
    )
}
