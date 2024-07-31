import { useState } from "react";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmRange } from "renderer/components/shared/bsm-range.component";
import { cn } from "renderer/helpers/css-class.helpers";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { PlaylistSearchParams } from "shared/models/maps/beat-saver.model"
import {DateRangePicker} from "@nextui-org/date-picker";
import { Radio, RadioGroup, RadioProps, RangeValue } from "@nextui-org/react";
import { today, getLocalTimeZone, parseAbsoluteToLocal, toCalendarDate, toZoned, CalendarDate } from "@internationalized/date";
import { motion } from "framer-motion";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { GlowEffect } from "renderer/components/shared/glow-effect.component";
import { useConstant } from "renderer/hooks/use-constant.hook";
import equal from "fast-deep-equal";

export type FilterPlaylistSearchParams = Pick<PlaylistSearchParams, "curated"|"verified"|"includeEmpty"|"from"|"to"|"minNps"|"maxNps">;

type Props = {
    className?: string;
    params?: FilterPlaylistSearchParams;
    onChange?: (params: FilterPlaylistSearchParams) => void;
    onSubmit?: (params: FilterPlaylistSearchParams) => void;
}

const MAX_NPS = 17;
const MIN_NPS = 0;

export function DownloadPlaylistFilterPanel({ className, params, onChange, onSubmit }: Props) {

    const t = useTranslation();

    const timeZone = useConstant(() => getLocalTimeZone());
    const [curated, setCurated] = useState<boolean>(params?.curated);
    const [verified, setVerified] = useState<boolean>(params?.verified);
    const [includeEmpty, setIncludeEmpty] = useState<boolean>(params?.includeEmpty);
    const [minNps, setMinNps] = useState<number>(params?.minNps);
    const [maxNps, setMaxNps] = useState<number>(params?.maxNps);
    const [dateRange, setDateRange] = useState<RangeValue<CalendarDate>>({
        start: params?.from ? toCalendarDate(parseAbsoluteToLocal(params.from)) : null,
        end: params?.from ? toCalendarDate(parseAbsoluteToLocal(params.from)) : null,
    });

    const filterValue: FilterPlaylistSearchParams = {
        curated,
        verified,
        includeEmpty, minNps,
        maxNps,
        from: dateRange?.start ? toZoned(dateRange.start, timeZone).set({ hour: 0, minute: 0 }).toAbsoluteString() : undefined,
        to: dateRange?.end ? toZoned(dateRange.end, timeZone).set({ hour: 23, minute: 59, second: 59 }).toAbsoluteString() : undefined,
    };
    const firstFilterValue = useConstant(() => ({...filterValue}));
    const filterHasBeenChanged = !equal(firstFilterValue, filterValue);

    useOnUpdate(() => {
        onChange?.(filterValue);
    }, [curated, verified, includeEmpty, minNps, maxNps, dateRange]);

    const handleOnNpsChange = ([min, max]: number[]) => {
        setMinNps(() => min <= MIN_NPS ? undefined : min);
        setMaxNps(() => max >= MAX_NPS ? undefined : max);
    }

    const renderNpsLabel = (value: number) => {
        const label = value === MAX_NPS ? `∞` : value;
        return renderRangeLabel(label, value === MAX_NPS);
    }

    const renderRangeLabel = (text: string | number, isMax: boolean): JSX.Element => {
        return <span className={`bg-inherit absolute top-[calc(100%+4px)] whitespace-nowrap h-5 font-bold rounded-md shadow-center shadow-black px-1 flex items-center ${isMax ? "text-lg" : "text-sm"}`}>{text}</span>;
    };

    // eslint-disable-next-line react/no-unstable-nested-components
    const CustomRadio = (props: RadioProps) => {
        const {children, ...otherProps} = props;

        return (
            <Radio
                {...otherProps}
                classNames={{
                    base: cn(
                      "flex-none m-0 h-8 bg-content1 hover:bg-content2 items-center justify-between",
                      "cursor-pointer rounded-full border-2 border-default-200/60",
                      "data-[selected=true]:border-primary",
                    ),
                    label: "text-tiny text-default-500",
                    labelWrapper: "px-1 m-0",
                    wrapper: "hidden",
                }}
            >
                {children}
            </Radio>
        );
    };

    const handleDatePreset = (radioElt: HTMLInputElement) => {
        const rawSplited = radioElt.value.split("_");
        const [type, value] = [rawSplited[0], parseInt(rawSplited.at(1))];

        if(!value || !type){
            return setDateRange(() => ({ start: null, end: null }));
        };

        const end = today(timeZone);

        setDateRange(() => ({
            start: end.subtract({ [type]: value }),
            end,
        }))
    };

    return (
        <motion.div className={cn("bg-theme-3 flex flex-row gap-3 p-2 absolute origin-top shadow-md shadow-black rounded-md", className)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{duration: .1}}>
            <div className="flex flex-col gap-1 shrink-0">
                <h2 className="mb-0.5 uppercase text-sm">{t("maps.map-filter-panel.specificities")}</h2>
                <div className="flex flex-row h-6 gap-1">
                    <BsmCheckbox className="relative h-full aspect-square" checked={curated} onChange={setCurated}/>
                    <span>{t("playlist.curated")}</span>
                </div>
                <div className="flex flex-row h-6 gap-1">
                    <BsmCheckbox className="relative h-full aspect-square" checked={verified} onChange={setVerified}/>
                    <span>{t("playlist.verified-mapper")}</span>
                </div>
                <div className="flex flex-row h-6 gap-1">
                    <BsmCheckbox className="relative h-full aspect-square" checked={includeEmpty} onChange={setIncludeEmpty}/>
                    <span>{t("playlist.empty-playlists")}</span>
                </div>
            </div>
            <div className="flex flex-col items-end grow shrink-0 min-w-64 gap-2">
                <div className="w-full flex flex-col justify-center p-2">
                    <BsmRange values={[minNps ?? MIN_NPS, maxNps ?? MAX_NPS]} min={MIN_NPS} max={MAX_NPS} step={0.1} onChange={handleOnNpsChange} renderLabel={renderNpsLabel}/>
                    <span className=" text-sm font-bold text-center mt-2.5">{t("maps.map-filter-panel.nps")}</span>
                </div>
                <div className="w-full">
                    <DateRangePicker label={t("playlist.date-picker.start-date-end-date")} value={dateRange} onChange={setDateRange} classNames={{
                        inputWrapper: "pointer-events-none bg-light-main-color-1 hover:bg-light-main-color-1 dark:bg-main-color-1 dark:hover:bg-main-color-1 hover:brightness-75",
                        input: "pointer-events-auto",
                        selectorButton: "pointer-events-auto",
                    }} CalendarBottomContent={
                        <RadioGroup onChange={e => handleDatePreset(e.target)} classNames={{
                            base: "w-[var(--calendar-width)] pb-2",
                            wrapper: "flex flex-row flex-wrap -my-2.5 py-2.5 px-3 gap-1 overflow-scroll max-w-[var(--calendar-width)] w-[var(--calendar-width)]"
                        }}>
                            <CustomRadio value="days_0">{t("playlist.date-picker.all")}</CustomRadio>
                            <CustomRadio value="days_1">{t("playlist.date-picker.last-24h")}</CustomRadio>
                            <CustomRadio value="weeks_1">{t("playlist.date-picker.last-week")}</CustomRadio>
                            <CustomRadio value="months_1">{t("playlist.date-picker.last-month")}</CustomRadio>
                            <CustomRadio value="months_3">{t("playlist.date-picker.3-last-month")}</CustomRadio>
                        </RadioGroup>
                    }/>
                </div>
                { onSubmit && (
                    <div className="float-right relative w-fit h-7 my-0.5">
                        <BsmButton className="flex justify-center items-center rounded-md font-bold px-3 pb-0.5 text-sm size-full" text="misc.apply" typeColor="primary" withBar={false} onClick={() => onSubmit(filterValue)} />
                        <GlowEffect visible={filterHasBeenChanged} />
                    </div>
                ) }
            </div>
        </motion.div>
    )
}
