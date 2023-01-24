import { MapFilter, MapSpecificity, MapStyle, MapTag, MapType } from "shared/models/maps/beat-saver.model"
import {motion} from "framer-motion"
import { MutableRefObject, useEffect, useRef, useState} from "react"
import { MAP_TYPES } from "renderer/partials/maps/map-tags/map-types"
import { MAP_STYLES } from "renderer/partials/maps/map-tags/map-styles"
import { BsmCheckbox } from "../shared/bsm-checkbox.component"
import { min_to_s } from "renderer/helpers/time-utils"
import dateFormat from "dateformat"
import { BsmRange } from "../shared/bsm-range.component"
import { useTranslation } from "renderer/hooks/use-translation.hook"
import { MAP_SPECIFICITIES } from "renderer/partials/maps/map-general/map-specificity"
import { MAP_REQUIREMENTS } from "renderer/partials/maps/map-requirements/map-requirements"
import { MAP_DIFFICULTIES_COLORS } from "renderer/partials/maps/map-difficulties/map-difficulties-colors"
import { BsmButton } from "../shared/bsm-button.component"
import equal from "fast-deep-equal/es6";
import clone from "rfdc";
import { GlowEffect } from "../shared/glow-effect.component"

export type Props = {
    className?: string,
    ref?: MutableRefObject<undefined>
    playlist?: boolean,
    filter: MapFilter,
    onChange?: (filter: MapFilter) => void,
    onApply?: (filter: MapFilter) => void,
    onClose?: (filter: MapFilter) => void
}

export function FilterPanel({className, ref, playlist = false, filter, onChange, onApply, onClose}: Props) {

    const t = useTranslation();

    const [haveChanged, setHaveChanged] = useState(false);
    const [firstFilter,] = useState(clone()(filter));
    const firstRun = useRef(true);

    const MIN_NPS = 0;
    const MAX_NPS = 17;

    const MIN_DURATION = 0;
    const MAX_DURATION = min_to_s(30);

    const npss = [filter?.minNps || MIN_NPS, filter?.maxNps || MAX_NPS];
    const durations = [filter?.minDuration || MIN_DURATION, filter?.maxDuration || MAX_DURATION];

    const isTagActivated = (tag: MapTag): boolean => filter?.enabledTags?.has(tag) || filter?.excludedTags?.has(tag);
    const isTagExcluded = (tag: MapTag): boolean => filter?.excludedTags?.has(tag);

    useEffect(() => {
        if(firstRun.current){
            firstRun.current = false;
            return; 
        }
        console.log(filter, firstFilter);
        setHaveChanged(() => !equal(filter, firstFilter));
    }, [filter])
    

    const renderDurationLabel = (sec: number): JSX.Element => {

        const textValue = (() => {
            if(sec === MIN_DURATION){ return t("maps.map-filter-panel.duration"); }
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
        if(min === MIN_NPS){
            delete newFilter["minNps"];
        }
        onChange(newFilter);
    }

    const onDurationsChange = ([min, max]: number[]) => {
        const newFilter: MapFilter = {...filter, minDuration: min, maxDuration: max};
        if(max === MAX_DURATION){
            delete newFilter["maxDuration"];
        }
        if(min === MIN_DURATION){
            delete newFilter["minDuration"];
        }
        onChange(newFilter);
    }

    const handleTagClick = (tag: MapTag) => {
        
        const enabledTags = filter.enabledTags ?? new Set<MapTag>();
        const excludedTags = filter.excludedTags ?? new Set<MapTag>();

        if(isTagExcluded(tag)){
            excludedTags.delete(tag);
        }
        else if(isTagActivated(tag)){
            excludedTags.add(tag);
            enabledTags.delete(tag);
        }
        else{
            enabledTags.add(tag);
        }

        const newFilter = {...filter, enabledTags, excludedTags};

        if(newFilter.enabledTags.size === 0){
            delete newFilter["enabledTags"];
        }

        if(newFilter.excludedTags.size === 0){
            delete newFilter["excludedTags"];
        }

        onChange(newFilter);

    }

    const translateMapType = (type: MapType): string => {
        return t(`maps.map-types.${type}`);
    }

    const translateMapStyle = (style: MapStyle): string => {
        return t(`maps.map-styles.${style}`)
    }

    const translateMapSpecificity = (specificity: MapSpecificity): string => {
        return t(`maps.map-specificities.${specificity}`);
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

    const handleApply = () => {
        onApply(filter);
        setHaveChanged(() => false);
        onClose?.(filter);
    }

    return !playlist ? (
        <motion.div ref={ref} className={`${className} bg-light-main-color-2 dark:bg-main-color-3`} initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
            <div className="w-full h-6 grid grid-cols-2 gap-x-12 px-4 mb-6 pt-2">
                <BsmRange min={MIN_NPS} max={MAX_NPS} values={npss} onChange={onNpssChange} renderLabel={renderNpsLabel} step={.1}/>
                <BsmRange min={MIN_DURATION} max={MAX_DURATION} values={durations} onChange={onDurationsChange} renderLabel={renderDurationLabel} step={5}/>
            </div>
            <div className="w-full h-full flex gap-x-2">
                <section className="shrink-0">

                    <h2 className="mb-1 uppercase text-sm">{t("maps.map-filter-panel.specificities")}</h2>
                    {MAP_SPECIFICITIES.map(specificity => (
                        <div key={specificity} className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={() => handleCheckbox(specificity)}>
                            <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.[specificity]} onChange={() => handleCheckbox(specificity)}/>
                            <span className="grow capitalize">{translateMapSpecificity(specificity)}</span>
                        </div>
                    ))}

                    <h2 className="my-1 uppercase text-sm">{t("maps.map-filter-panel.requirements")}</h2>
                    {MAP_REQUIREMENTS.map(requirement => (
                        <div key={requirement} className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={() => handleCheckbox(requirement)}>
                            <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.[requirement]} onChange={() => handleCheckbox(requirement)}/>
                            <span className="grow capitalize">{requirement}</span>
                        </div>
                    ))}
                    
                </section>  
                <section className="grow capitalize">
                    <h2 className="uppercase text-sm mb-1">{t("maps.map-filter-panel.tags")}</h2>
                    <div className="w-full flex flex-row flex-wrap items-start justify-start content-start gap-1 mb-2">
                        {MAP_TYPES.map(tag => (
                            <span key={tag} onClick={() => handleTagClick(tag)} className={`text-[12.5px] text-black rounded-md px-1 font-bold cursor-pointer ${(!isTagActivated(tag)) && "opacity-40 hover:opacity-90"}`} style={{backgroundColor: isTagExcluded(tag) ? MAP_DIFFICULTIES_COLORS.Expert : MAP_DIFFICULTIES_COLORS.Normal}}>{translateMapType(tag)}</span>
                        ))}
                    </div>
                    <div className="w-full flex flex-row flex-wrap items-start justify-start content-start gap-1">
                        {MAP_STYLES.map(tag => (
                            <span key={tag} onClick={() => handleTagClick(tag)} className={`text-[12.5px] text-black rounded-md px-1 font-bold cursor-pointer ${(!isTagActivated(tag)) && "opacity-40 hover:opacity-90"}`} style={{backgroundColor: isTagExcluded(tag) ? MAP_DIFFICULTIES_COLORS.Expert : MAP_DIFFICULTIES_COLORS.Easy}}>{translateMapStyle(tag)}</span>
                        ))}
                    </div>
                </section>
            </div>
            {onApply && (
                <div className="inline float-right relative w-fit h-fit mt-2">
                    <BsmButton className="inline float-right rounded-md font-bold px-1 py-0.5 text-sm" text="Appliquer" typeColor="primary" withBar={false} onClick={handleApply}/>
                    <GlowEffect visible={haveChanged}/>
                </div>
            )}
        </motion.div>
    ) : (
    <></>
    )
}
