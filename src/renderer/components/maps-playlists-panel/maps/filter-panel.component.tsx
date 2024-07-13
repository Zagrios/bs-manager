import { BsvMapDetail, MapFilter, MapRequirement, MapSpecificity, MapStyle, MapTag, MapType } from "shared/models/maps/beat-saver.model";
import { motion } from "framer-motion";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { BsmCheckbox } from "../../shared/bsm-checkbox.component";
import { minToS } from "../../../../shared/helpers/time.helpers";
import dateFormat from "dateformat";
import { BsmRange } from "../../shared/bsm-range.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { MAP_DIFFICULTIES_COLORS } from "shared/models/maps/difficulties-colors";
import { BsmButton } from "../../shared/bsm-button.component";
import equal from "fast-deep-equal/es6";
import clone from "rfdc";
import { GlowEffect } from "../../shared/glow-effect.component";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { SongDetails } from "shared/models/maps";

export type Props = {
    className?: string;
    ref?: MutableRefObject<undefined>;
    playlist?: boolean;
    filter: MapFilter;
    localData?: boolean;
    onChange?: (filter: MapFilter) => void;
    onApply?: (filter: MapFilter) => void;
    onClose?: (filter: MapFilter) => void;
};

export function FilterPanel({ className, ref, playlist = false, filter, localData = true, onChange, onApply, onClose }: Props) {
    const t = useTranslation();

    const [haveChanged, setHaveChanged] = useState(false);
    const [firstFilter] = useState(clone()(filter));
    const firstRun = useRef(true);

    const MIN_NPS = 0;
    const MAX_NPS = 17;

    const MIN_DURATION = 0;
    const MAX_DURATION = minToS(30);

    const npss = [filter?.minNps || MIN_NPS, filter?.maxNps || MAX_NPS];
    const durations = [filter?.minDuration || MIN_DURATION, filter?.maxDuration || MAX_DURATION];

    const isTagActivated = (tag: MapTag): boolean => filter?.enabledTags?.has(tag) || filter?.excludedTags?.has(tag);
    const isTagExcluded = (tag: MapTag): boolean => filter?.excludedTags?.has(tag);

    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        setHaveChanged(() => !equal(filter, firstFilter));
    }, [filter]);

    const renderDurationLabel = (sec: number): JSX.Element => {
        const textValue = (() => {
            if (sec === MIN_DURATION) {
                return MIN_DURATION;
            }
            if (sec === MAX_DURATION) {
                return "∞";
            }
            const date = new Date(0);
            date.setSeconds(sec);
            return sec > 3600 ? dateFormat(date, "h:MM:ss") : dateFormat(date, "MM:ss");
        })();

        return renderLabel(textValue, sec === MAX_DURATION);
    };

    const renderNpsLabel = (nps: number): JSX.Element => {
        const textValue = (() => {
            if (nps === MAX_NPS) { return "∞"; }
            return nps;
        })();

        return renderLabel(textValue, nps === MAX_NPS);
    };

    const renderLabel = (text: string | number, isMax: boolean): JSX.Element => {
        return <span className={`bg-inherit absolute top-[calc(100%+4px)] whitespace-nowrap h-5 font-bold rounded-md shadow-center shadow-black px-1 flex items-center ${isMax ? "text-lg" : "text-sm"}`}>{text}</span>;
    };

    const onNpssChange = ([min, max]: number[]) => {
        const newFilter: MapFilter = { ...filter, minNps: min, maxNps: max };
        if (max === MAX_NPS) {
            delete newFilter.maxNps;
        }
        if (min === MIN_NPS) {
            delete newFilter.minNps;
        }
        onChange(newFilter);
    };

    const onDurationsChange = ([min, max]: number[]) => {
        const newFilter: MapFilter = { ...filter, minDuration: min, maxDuration: max };
        if (max === MAX_DURATION) {
            delete newFilter.maxDuration;
        }
        if (min === MIN_DURATION) {
            delete newFilter.minDuration;
        }
        onChange(newFilter);
    };

    const handleTagClick = (tag: MapTag) => {
        const enabledTags = filter.enabledTags ?? new Set<MapTag>();
        const excludedTags = filter.excludedTags ?? new Set<MapTag>();

        if (isTagExcluded(tag)) {
            excludedTags.delete(tag);
        } else if (isTagActivated(tag)) {
            excludedTags.add(tag);
            enabledTags.delete(tag);
        } else {
            enabledTags.add(tag);
        }

        const newFilter = { ...filter, enabledTags, excludedTags };

        if (newFilter.enabledTags.size === 0) {
            delete newFilter.enabledTags;
        }

        if (newFilter.excludedTags.size === 0) {
            delete newFilter.excludedTags;
        }

        onChange(newFilter);
    };

    const translateMapType = (type: MapType): string => {
        return t(`maps.map-types.${type}`);
    };

    const translateMapStyle = (style: MapStyle): string => {
        return t(`maps.map-styles.${style}`);
    };

    const translateMapSpecificity = (specificity: MapSpecificity): string => {
        return t(`maps.map-specificities.${specificity}`);
    };

    type BooleanKeys<T> = { [k in keyof T]: T[k] extends boolean ? k : never }[keyof T];

    const handleCheckbox = (key: BooleanKeys<MapFilter>) => {
        const newFilter = { ...(filter ?? {}) };
        if (newFilter[key] === true) {
            delete newFilter[key];
        } else {
            newFilter[key] = true;
        }
        onChange(newFilter);
    };

    const handleApply = () => {
        onApply(filter);
        setHaveChanged(() => false);
        onClose?.(filter);
    };

    return !playlist ? (
        <motion.div ref={ref} className={`${className} bg-light-main-color-2 dark:bg-main-color-3`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} draggable>
            <div className="w-full h-6 grid grid-cols-2 gap-x-12 px-4 mb-6 pt-1">
              <BsmRange min={MIN_NPS} max={MAX_NPS} values={npss} onChange={onNpssChange} renderLabel={renderNpsLabel} step={0.1} />
              <BsmRange min={MIN_DURATION} max={MAX_DURATION} values={durations} onChange={onDurationsChange} renderLabel={renderDurationLabel} step={5} />
              <span className=" text-sm font-bold text-center mt-2.5">{t("maps.map-filter-panel.nps")}</span>
              <span className=" text-sm font-bold text-center mt-2.5">{t("maps.map-filter-panel.duration")}</span>
            </div>
            <div className="w-full h-full flex gap-x-2">
                <section className="shrink-0">
                    <h2 className="mb-1 uppercase text-sm">{t("maps.map-filter-panel.specificities")}</h2>
                    {Object.values(MapSpecificity).map(specificity => (
                        <div key={specificity} className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={() => handleCheckbox(specificity)}>
                            <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.[specificity]} onChange={() => handleCheckbox(specificity)} />
                            <span className="grow capitalize">{translateMapSpecificity(specificity)}</span>
                        </div>
                    ))}
                    <h2 className="my-1 uppercase text-sm">{t("maps.map-filter-panel.requirements")}</h2>
                    {Object.values(MapRequirement).map(requirement => (
                        <div key={requirement} className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={() => handleCheckbox(requirement)}>
                            <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.[requirement]} onChange={() => handleCheckbox(requirement)} />
                            <span className="grow capitalize">{requirement}</span>
                        </div>
                    ))}
                    { !localData && (
                        <>
                            <h2 className="my-1 uppercase text-sm">{t("maps.map-filter-panel.exclude")}</h2>
                            <div className="flex justify-start items-center h-[22px] z-20 relative py-0.5 cursor-pointer" onClick={() => handleCheckbox("installed")}>
                                <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1" checked={filter?.installed} onChange={() => handleCheckbox("installed")} />
                                <span className="grow capitalize">{t("maps.map-excludes.installed")}</span>
                            </div>
                        </>
                    )}
                </section>
                <section className="grow capitalize">
                    <h2 className="uppercase text-sm mb-1">{t("maps.map-filter-panel.tags")}</h2>
                    <div className="w-full flex flex-row flex-wrap items-start justify-start content-start gap-1 mb-2">
                        {Object.values(MapType).map(tag => (
                            <span key={tag} onClick={() => handleTagClick(tag)} className={`text-[12.5px] text-black rounded-md px-1 font-bold cursor-pointer ${!isTagActivated(tag) && "opacity-40 hover:opacity-90"}`} style={{ backgroundColor: isTagExcluded(tag) ? MAP_DIFFICULTIES_COLORS.Expert : MAP_DIFFICULTIES_COLORS.Normal }}>
                                {translateMapType(tag)}
                            </span>
                        ))}
                    </div>
                    <div className="w-full flex flex-row flex-wrap items-start justify-start content-start gap-1">
                        {Object.values(MapStyle).map(tag => (
                            <span key={tag} onClick={() => handleTagClick(tag)} className={`text-[12.5px] text-black rounded-md px-1 font-bold cursor-pointer ${!isTagActivated(tag) && "opacity-40 hover:opacity-90"}`} style={{ backgroundColor: isTagExcluded(tag) ? MAP_DIFFICULTIES_COLORS.Expert : MAP_DIFFICULTIES_COLORS.Easy }}>
                                {translateMapStyle(tag)}
                            </span>
                        ))}
                    </div>
                </section>
            </div>
            {onApply && (
                <div className="inline float-right relative w-fit h-fit mt-2">
                    <BsmButton className="inline float-right rounded-md font-bold px-1 py-0.5 text-sm" text="misc.apply" typeColor="primary" withBar={false} onClick={handleApply} />
                    <GlowEffect visible={haveChanged} />
                </div>
            )}
        </motion.div>
    ) : (
        undefined
    );
}

// Filter functions

function isFitEnabledTags(filter: MapFilter, tags: MapTag[]): boolean {
    if (!filter?.enabledTags || filter.enabledTags.size === 0) { return true; }
    if(!Array.isArray(tags)) { return false; }
    return Array.from(filter.enabledTags.values()).every(tag => tags.some(mapTag => mapTag === tag));
}

function isFitExcludedTags(filter: MapFilter, tags: MapTag[]): boolean {
    if (!filter?.excludedTags || filter.excludedTags.size === 0) { return true; }
    if(!Array.isArray(tags)) { return false; }
    return !tags.some(tag => filter.excludedTags.has(tag));
}

function isFitMinNps(filter: MapFilter, nps: number): boolean {
    if (!filter?.minNps) { return true; }
    return nps > filter.minNps;
}

function isFitMaxNps(filter: MapFilter, nps: number): boolean {
    if (!filter?.maxNps) { return true; }
    return nps < filter.maxNps;
}

function isFitMinDuration(filter: MapFilter, duration: number): boolean {
    if (!filter?.minDuration) { return true; }
    return duration >= filter.minDuration;
}

function isFitMaxDuration(filter: MapFilter, duration: number): boolean {
    if (!filter?.maxDuration) { return true; }
    return duration <= filter.maxDuration;
}

function isFitNoodle(filter: MapFilter, noodle: boolean): boolean {
    if (!filter?.noodle) { return true; }
    return noodle;
}

function isFitMe(filter: MapFilter, me: boolean): boolean {
    if (!filter?.me) { return true; }
    return me;
}

function isFitCinema(filter: MapFilter, cinema: boolean): boolean {
    if (!filter?.cinema) { return true; }
    return cinema;
}

function isFitChroma(filter: MapFilter, chroma: boolean): boolean {
    if (!filter?.chroma) { return true; }
    return chroma;
}

function isFitFullSpread(filter: MapFilter, nbDiff: number): boolean {
    if (!filter?.fullSpread) { return true; }
    return nbDiff >= 5;
}

function isFitAutomapper(filter: MapFilter, automapper: boolean): boolean {
    if (!filter?.automapper) { return true; }
    return automapper;
}


function isFitRanked(filter: MapFilter, ranked: boolean): boolean {
    if (!filter?.ranked) { return true; }
    return ranked;
}

function isFitCurated(filter: MapFilter, curated: boolean): boolean {
    if (!filter?.curated) { return true; }
    return curated;
}

function isFitVerified(filter: MapFilter, verified: boolean): boolean {
    if (!filter?.verified) { return true; }
    return verified;
}

function isFitSearch(search: string, {songName, songAuthorName, levelAuthorName}: {songName: string, songAuthorName: string, levelAuthorName: string}): boolean {
    if (!search) { return true; }
    return songName?.toLowerCase().includes(search.toLowerCase()) || songAuthorName?.toLowerCase().includes(search.toLowerCase()) || levelAuthorName?.toLowerCase().includes(search.toLowerCase());
}

export const isLocalMapFitMapFilter = ({filter, map, search}: { filter: MapFilter, map: BsmLocalMap, search: string }): boolean => {
    if (!isFitEnabledTags(filter, map.songDetails?.tags)) { return false; }
    if (!isFitExcludedTags(filter, map.songDetails?.tags)) { return false; }
    if (map?.songDetails?.difficulties?.length && !map.songDetails?.difficulties.some(diff => isFitMinNps(filter, diff.nps))) { return false; }
    if (map?.songDetails?.difficulties?.length && !map.songDetails?.difficulties.some(diff => isFitMaxNps(filter, diff.nps))) { return false; }
    if (!isFitMinDuration(filter, map.songDetails?.duration)) { return false; }
    if (!isFitMaxDuration(filter, map.songDetails?.duration)) { return false; }
    if (!isFitNoodle(filter, map.songDetails?.difficulties.some(diff => !!diff.ne))) { return false; }
    if (!isFitMe(filter, map.songDetails?.difficulties.some(diff => !!diff.me))) { return false; }
    if (!isFitCinema(filter, map.songDetails?.difficulties.some(diff => !!diff.cinema))) { return false; }
    if (!isFitChroma(filter, map.songDetails?.difficulties.some(diff => !!diff.chroma))) { return false; }
    if (!isFitFullSpread(filter, map.songDetails?.difficulties.length)) { return false; }
    if (!isFitAutomapper(filter, map.songDetails?.automapper)){ return false; }
    if (!isFitRanked(filter, map.songDetails?.ranked || map.songDetails?.blRanked)) { return false; }
    if (!isFitCurated(filter, map.songDetails?.curated)) { return false; }
    if (!isFitVerified(filter, map.songDetails?.uploader.verified)) { return false; }
    if (!isFitSearch(search, {songName: map.rawInfo?._songName, songAuthorName: map.rawInfo?._songAuthorName, levelAuthorName: map.rawInfo?._levelAuthorName})) { return false; }
    return true;
};

export const isBsvMapFitMapFilter = ({filter, map, search}: { filter: MapFilter, map: BsvMapDetail, search: string }): boolean => {

    if (!isFitEnabledTags(filter, map.tags)) { return false; }
    if (!isFitExcludedTags(filter, map.tags)) { return false; }
    if (map.versions?.at(0)?.diffs && !map.versions.at(0).diffs.some(diff => isFitMinNps(filter, diff.nps))) { return false; }
    if (map.versions?.at(0)?.diffs && !map.versions.at(0).diffs.some(diff => isFitMaxNps(filter, diff.nps))) { return false; }
    if (!isFitMinDuration(filter, map.metadata.duration)) { return false; }
    if (!isFitMaxDuration(filter, map.metadata.duration)) { return false; }
    if (!isFitNoodle(filter, map.versions?.at(0)?.diffs.some(diff => !!diff.ne))) { return false; }
    if (!isFitMe(filter, map.versions?.at(0)?.diffs.some(diff => !!diff.me))) { return false; }
    if (!isFitCinema(filter, map.versions?.at(0)?.diffs.some(diff => !!diff.cinema))) { return false; }
    if (!isFitChroma(filter, map.versions?.at(0)?.diffs.some(diff => !!diff.chroma))) { return false; }
    if (!isFitFullSpread(filter, map.versions?.at(0)?.diffs.length)) { return false; }
    if (!isFitAutomapper(filter, map.automapper)){ return false; }
    if (!isFitRanked(filter, map.ranked || map.blRanked)) { return false; }
    if (!isFitCurated(filter, !!map.curator)) { return false; }
    if (!isFitVerified(filter, !!map.curatedAt)) { return false; }
    if (!isFitSearch(search, {songName: map.name, songAuthorName: map.metadata.songAuthorName, levelAuthorName: map.metadata.levelAuthorName})) { return false; }
    return true;
};

export const isSongDetailsFitMapFilter = ({filter, map, search}: { filter: MapFilter, map: SongDetails, search: string }): boolean => {
    if (!isFitEnabledTags(filter, map.tags)) { return false; }
    if (!isFitExcludedTags(filter, map.tags)) { return false; }
    if (map.difficulties && !map.difficulties.some(diff => isFitMinNps(filter, diff.nps))) { return false; }
    if (map.difficulties && !map.difficulties.some(diff => isFitMaxNps(filter, diff.nps))) { return false; }
    if (!isFitMinDuration(filter, map.duration)) { return false; }
    if (!isFitMaxDuration(filter, map.duration)) { return false; }
    if (!isFitNoodle(filter, map.difficulties.some(diff => !!diff.ne))) { return false; }
    if (!isFitMe(filter, map.difficulties.some(diff => !!diff.me))) { return false; }
    if (!isFitCinema(filter, map.difficulties.some(diff => !!diff.cinema))) { return false; }
    if (!isFitChroma(filter, map.difficulties.some(diff => !!diff.chroma))) { return false; }
    if (!isFitFullSpread(filter, map.difficulties.length)) { return false; }
    if (!isFitAutomapper(filter, map.automapper)){ return false; }
    if (!isFitRanked(filter, map.ranked || map.blRanked)) { return false; }
    if (!isFitCurated(filter, map.curated)) { return false; }
    if (!isFitVerified(filter, map.uploader.verified)) { return false; }
    if (!isFitSearch(search, {songName: map.name, songAuthorName: map.uploader.name, levelAuthorName: map.uploader.name})) { return false; }
    return true;
}

export const isMapFitFilter = ({filter, map, search}: { filter: MapFilter, map: BsmLocalMap | BsvMapDetail | SongDetails, search: string }): boolean => {
    if ((map as BsmLocalMap)?.rawInfo) { return isLocalMapFitMapFilter({filter, map: (map as BsmLocalMap), search}); }
    if ((map as BsvMapDetail)?.metadata) { return isBsvMapFitMapFilter({filter, map: (map as BsvMapDetail), search}); }
    if ((map as SongDetails).hash) { return isSongDetailsFitMapFilter({filter, map: (map as SongDetails), search}); }
    return false;
};
