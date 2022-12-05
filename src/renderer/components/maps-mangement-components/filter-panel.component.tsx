import { MapFilter, MapTag } from "shared/models/maps/beat-saver.model"
import {motion} from "framer-motion"
import { MutableRefObject} from "react"
import { MAP_TYPES } from "renderer/partials/maps/map-tags/map-types"
import { MAP_STYLES } from "renderer/partials/maps/map-tags/map-styles"
import { BsmCheckbox } from "../shared/bsm-checkbox.component"
import { diffColors } from "./map-item.component"
import { min_to_s } from "renderer/helpers/time-utils"
import dateFormat from "dateformat"
import { BsmRange } from "../shared/bsm-range.component"

export type Props = {
    className?: string,
    ref?: MutableRefObject<undefined>
    playlist?: boolean,
    filter: MapFilter
    onChange?: (filter: MapFilter) => void
}

export function FilterPanel({className, ref, playlist = false, filter, onChange}: Props) {

    const MIN_NPS = 0;
    const MAX_NPS = 17;

    const MIN_DURATION = 0;
    const MAX_DURATION = min_to_s(30);

    const npss = [filter?.minNps || MIN_NPS, filter?.maxNps || MAX_NPS];
    const durations = [filter?.minDuration || MIN_DURATION, filter?.maxDuration || MAX_DURATION];

    const isTagActivated = (tag: MapTag): boolean => filter?.enabledTags?.has(tag) || filter?.excludedTags?.has(tag);
    const isTagExcluded = (tag: MapTag): boolean => filter?.excludedTags?.has(tag);

    const renderDurationLabel = (sec: number): JSX.Element => {

        const textValue = (() => {
            if(sec === MIN_DURATION){ return "Durée"; } //TODO TRADUIRE
            if(sec === MAX_DURATION){ return "∞"; }
            const date = new Date(0);
            date.setSeconds(sec);
            return sec > 3600 ? dateFormat(date, "h:MM:ss") : dateFormat(date, "MM:ss");
        })();

        return renderLabel(textValue, sec === MAX_DURATION);
    }

    const renderNpsLabel = (nps: number): JSX.Element => {

        const textValue = (() => {
            if(nps === MIN_NPS){ return "NPS"; }
            if(nps === MAX_NPS){ return "∞"; }
            return nps;
        })();

        return renderLabel(textValue, nps === MAX_NPS);

    }
 
    const renderLabel = (text: unknown, isMax: boolean): JSX.Element => {
        return (
            <span className={`bg-inherit absolute top-[calc(100%+4px)] h-5 font-bold rounded-md shadow-center shadow-black px-1 flex items-center ${isMax ? "text-lg" : "text-sm"}`}>
                {text}
            </span>
        )
    }

    const onNpssChange = ([min, max]: number[]) => {
        const newFilter: MapFilter = {...filter, minNps: min, maxNps: max};
        if(max === MAX_NPS){
            delete newFilter["maxNps"];
        }
        onChange(newFilter);
    }

    const onDurationsChange = ([min, max]: number[]) => {
        const newFilter: MapFilter = {...filter, minDuration: min, maxDuration: max};
        if(max === MAX_DURATION){
            delete newFilter["maxDuration"];
        }
        onChange(newFilter);
    }

    const handleTagClick = (tag: MapTag) => {
        if(filter.enabledTags.has(tag)){
            filter.enabledTags.delete(tag);
            filter.excludedTags.add(tag);
            return onChange({
                ...filter,
                enabledTags: filter.enabledTags,
                excludedTags: filter.excludedTags
            })
        }
        if(filter.excludedTags.has(tag)){
            filter.excludedTags.delete(tag);
            return onChange({
                ...filter,
                excludedTags: filter.excludedTags
            })
        }

        filter.enabledTags.add(tag);
        onChange({
            ...filter,
            enabledTags: filter.enabledTags
        })

    }

    type BooleanKeys<T> = { [k in keyof T]: T[k] extends boolean ? k : never }[keyof T];

    const handleCheckbox = (key: BooleanKeys<MapFilter>) => {
        const newFilter = {...(filter ?? {})};
        if(newFilter[key] === true){
            delete newFilter[key];
        }
        else{
            newFilter[key] = true;
        }
        onChange(newFilter);
    }

    return !playlist ? (
        <motion.div ref={ref} className={className} initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
            <div className="w-full h-6 grid grid-cols-2 gap-x-10 px-4 mb-6 pt-2">
                <BsmRange min={MIN_NPS} max={MAX_NPS} values={npss} onChange={onNpssChange} renderLabel={renderNpsLabel} step={.1}/>
                <BsmRange min={MIN_DURATION} max={MAX_DURATION} values={durations} onChange={onDurationsChange} renderLabel={renderDurationLabel} step={5}/>
            </div>
            <div className="w-full h-full flex gap-x-2">    {/* TODO TRADUIRE */}
                <section className="shrink-0">
                    <h2 className="mb-1 uppercase text-sm">general</h2>
                    <div className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={e => handleCheckbox("automapper")}>
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.automapper} onChange={() => handleCheckbox("automapper")}/>
                        <span className="grow capitalize">AI</span>
                    </div>
                    <div className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={e => handleCheckbox("ranked")}>
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.ranked} onChange={() => handleCheckbox("ranked")}/>
                        <span className="grow capitalize">Rancked</span>
                    </div>
                    <div className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={e => handleCheckbox("curated")}>
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.curated} onChange={() => handleCheckbox("curated")}/>
                        <span className="grow capitalize">Curated</span>
                    </div>
                    <div className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={e => handleCheckbox("verified")}>
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.verified} onChange={() => handleCheckbox("verified")}/>
                        <span className="grow capitalize">Verified Mapper</span>
                    </div>
                    <div className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={e => handleCheckbox("fullSpread")}>
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.fullSpread} onChange={() => handleCheckbox("fullSpread")}/>
                        <span className="grow capitalize">Full Spread</span>
                    </div>
                    <h2 className="my-1 uppercase text-sm">requirements</h2>
                    <div className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={e => handleCheckbox("chroma")}>
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.chroma} onChange={() => handleCheckbox("chroma")}/>
                        <span className="grow capitalize">Chroma</span>
                    </div>
                    <div className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={e => handleCheckbox("noodle")}>
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.noodle} onChange={() => handleCheckbox("noodle")}/>
                        <span className="grow capitalize">Noodle</span>
                    </div>
                    <div className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={e => handleCheckbox("me")}>
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.me} onChange={() => handleCheckbox("me")}/>
                        <span className="grow capitalize" title="Mapping Extensions">Me</span>
                    </div>
                    <div className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={e => handleCheckbox("cinema")}>
                        <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.cinema} onChange={() => handleCheckbox("cinema")}/>
                        <span className="grow capitalize">Cinema</span>
                    </div>
                    
                </section>  
                <section className="grow capitalize">
                    <h2 className="uppercase text-sm mb-1">TAGS</h2>
                    <div className="w-full flex flex-row flex-wrap items-start justify-start content-start gap-1 mb-2">
                        {MAP_TYPES.map(tag => (
                            <span key={tag} onClick={e => handleTagClick(tag)} className={`text-[12.5px] text-black rounded-md px-1 font-bold cursor-pointer ${(!isTagActivated(tag)) && "opacity-40 hover:opacity-100"}`} style={{backgroundColor: isTagExcluded(tag) ? diffColors.Expert : diffColors.Normal}}>{tag}</span>
                        ))}
                    </div>
                    <div className="w-full flex flex-row flex-wrap items-start justify-start content-start gap-1">
                        {MAP_STYLES.map(tag => (
                            <span key={tag} onClick={e => handleTagClick(tag)} className={`text-[12.5px] text-black rounded-md px-1 font-bold cursor-pointer ${(!isTagActivated(tag)) && "opacity-40 hover:opacity-100"}`} style={{backgroundColor: isTagExcluded(tag) ? diffColors.Expert : diffColors.Easy}}>{tag}</span>
                        ))}
                    </div>
                    
                    
                </section>
            </div>
        </motion.div>
    ) : (
    <></>
    )
}
