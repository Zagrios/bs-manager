import { motion } from "framer-motion"
import { Dispatch, SetStateAction, useState } from "react";
import { BsmRange } from "renderer/components/shared/bsm-range.component";
import { cn } from "renderer/helpers/css-class.helpers"
import { useTranslation } from "renderer/hooks/use-translation.hook";
import dateFormat from "dateformat";
import { hourToS, sToMs } from "shared/helpers/time.helpers";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";

type Props = {
    className?: string;
    filter?: LocalPlaylistFilter;
    onChange?: (filter: LocalPlaylistFilter) => void;
}

const [MIN_NB_MAPS, MAX_NB_MAPS] = [0, 1000];
const [MIN_NB_MAPPER, MAX_NB_MAPPER] = [0, 1000];
const [MIN_DURATION, MAX_DURATION] = [0, hourToS(9)];
const [MIN_NPS, MAX_NPS] = [0, 17];

export function LocalPlaylistFilterPanel({ className, filter, onChange }: Props) {

    const t = useTranslation();

    const [minNps, setMinNps] = useState<number>(filter?.minNps ?? MIN_NPS);
    const [maxNps, setMaxNps] = useState<number>(filter?.maxNps ?? MAX_NPS);

    const [minNbMaps, setMinNbMaps] = useState<number>(filter?.minNbMaps ?? MIN_NB_MAPS);
    const [maxNbMaps, setMaxNbMaps] = useState<number>(filter?.maxNbMaps ?? MAX_NB_MAPS);

    const [minNbMappers, setMinNbMappers] = useState<number>(filter?.minNbMappers ?? MIN_NB_MAPPER);
    const [maxNbMappers, setMaxNbMappers] = useState<number>(filter?.minNbMappers ?? MAX_NB_MAPPER);

    const [minDuration, setMinDuration] = useState<number>(filter?.minDuration ?? MIN_DURATION);
    const [maxDuration, setMaxDuration] = useState<number>(filter?.maxDuration ?? MAX_DURATION);

    useOnUpdate(() => {

        if(!onChange){ return; }

        const filter: LocalPlaylistFilter = {
            minNps: minNps <= MIN_NPS ? undefined : minNps,
            maxNps: maxNps >= MAX_NPS ? undefined : maxNps,
            minNbMaps: minNbMaps <= MIN_NB_MAPS ? undefined : minNbMaps,
            maxNbMaps: maxNbMaps >= MAX_NB_MAPS ? undefined : maxNbMaps,
            minNbMappers: minNbMappers <= MIN_NB_MAPPER ? undefined : minNbMappers,
            maxNbMappers: maxNbMappers >= MAX_NB_MAPPER ? undefined : maxNbMappers,
            minDuration: minDuration <= MIN_DURATION ? undefined : minDuration,
            maxDuration: maxDuration >= MAX_DURATION ? undefined : maxDuration,
        };

        onChange(filter);

    }, [minNps, maxNps, minNbMaps, maxNbMaps, minNbMappers, maxNbMappers, minDuration, maxDuration]);

    const handleRangeChange = ([minSetter, maxSetter]: Dispatch<SetStateAction<number>>[], [min, max]: number[], absoluteMin: number, absoluteMax: number) => {
        minSetter(() => min <= absoluteMin ? undefined : min);
        maxSetter(() => max >= absoluteMax ? undefined : max);
    };

    const handleOnNpsChange = (minMax: number[]) => handleRangeChange([setMinNps, setMaxNps], minMax, MIN_NPS, MAX_NPS);
    const handleOnNbMapsChange = (minMax: number[]) => handleRangeChange([setMinNbMaps, setMaxNbMaps], minMax, MIN_NB_MAPS, MAX_NB_MAPS);
    const handleOnNbMapperChange = (minMax: number[]) => handleRangeChange([setMinNbMappers, setMaxNbMappers], minMax, MIN_NB_MAPPER, MAX_NB_MAPPER);
    const handleOnDurationChange = (minMax: number[]) => handleRangeChange([setMinDuration, setMaxDuration], minMax, MIN_DURATION, MAX_DURATION);

    const renderLabel = (text: string | number, isMax: boolean): JSX.Element => {
        return <span className={`bg-inherit absolute top-[calc(100%+4px)] whitespace-nowrap h-5 font-bold rounded-md shadow-center shadow-black px-1 flex items-center ${isMax ? "text-lg" : "text-sm"}`}>{text}</span>;
    };

    const renderSimpleMinMaxLabel = (value: number, max: number) => {
        const label = value >= max ? `∞` : value;
        return renderLabel(label, label === "∞");
    }

    const renderDurationLabel = (sec: number): JSX.Element => {
        const textValue = (() => {
            if (sec === MIN_DURATION) {
                return MIN_DURATION;
            }
            if (sec === MAX_DURATION) {
                return "∞";
            }

            return sec > 3600 ? dateFormat(sToMs(sec), "h:MM:ss") : dateFormat(sToMs(sec), "MM:ss");
        })();

        return renderLabel(textValue, sec === MAX_DURATION);
    };

    return (
        <motion.div className={cn("bg-theme-3 flex flex-col gap-1.5 p-2 absolute origin-top shadow-md shadow-black rounded-md", className)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{duration: .1}}>
            <div className="w-full flex flex-col justify-center p-2">
                <BsmRange values={[minNbMaps ?? MIN_NB_MAPS, maxNbMaps ?? MAX_NB_MAPS]} min={MIN_NB_MAPS} max={MAX_NB_MAPS} step={1} onChange={handleOnNbMapsChange} renderLabel={v => renderSimpleMinMaxLabel(v, MAX_NB_MAPS)}/>
                <span className=" text-sm font-bold text-center mt-2.5">{t("playlist.nb-maps")}</span>
            </div>
            <div className="w-full flex flex-col justify-center p-2">
                <BsmRange values={[minNbMappers ?? MIN_NB_MAPPER, maxNbMappers ?? MAX_NB_MAPPER]} min={MIN_NB_MAPPER} max={MAX_NB_MAPPER} step={1} onChange={handleOnNbMapperChange} renderLabel={v => renderSimpleMinMaxLabel(v, MAX_NB_MAPPER)}/>
                <span className=" text-sm font-bold text-center mt-2.5">{t("playlist.nb-mappers")}</span>
            </div>
            <div className="w-full flex flex-col justify-center p-2">
                <BsmRange values={[minDuration ?? MIN_DURATION, maxDuration ?? MAX_DURATION]} min={MIN_DURATION} max={MAX_DURATION} step={1} onChange={handleOnDurationChange} renderLabel={renderDurationLabel}/>
                <span className=" text-sm font-bold text-center mt-2.5">{t("playlist.duration")}</span>
            </div>
            <div className="w-full flex flex-col justify-center p-2">
                <BsmRange values={[minNps ?? MIN_NPS, maxNps ?? MAX_NPS]} min={MIN_NPS} max={MAX_NPS} step={0.1} onChange={handleOnNpsChange} renderLabel={v => renderSimpleMinMaxLabel(v, MAX_NPS)}/>
                <span className=" text-sm font-bold text-center mt-2.5">{t("playlist.nps")}</span>
            </div>
        </motion.div>
    )
}

export type LocalPlaylistFilter = Partial<{
    minNps: number;
    maxNps: number;
    minNbMaps: number;
    maxNbMaps: number;
    minNbMappers: number;
    maxNbMappers: number;
    minDuration: number;
    maxDuration: number;
}>
