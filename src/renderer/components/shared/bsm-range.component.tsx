import { getTrackBackground, Range } from "react-range"
import { getCorrectTextColor } from "renderer/helpers/correct-text-color"
import { ThemeColor, useThemeColor } from "renderer/hooks/use-theme-color.hook"

type Props = {
    colorType?: ThemeColor
    values: number[],
    onChange?: (values: number[]) => void,
    onFinalChange?: (values: number[]) => void,
    min: number,
    max: number,
    step?: number,
    renderLabel?: (value: number) => JSX.Element,
}

export function BsmRange({colorType = "first-color", values, onChange, onFinalChange, min, max, renderLabel, step = 1} : Props) {

    const color = useThemeColor(colorType);
    const labelTextColor = getCorrectTextColor(color);

    return (
        <Range 
            values={values}
            min={min}
            max={max}
            step={step}
            onChange={(v) => onChange?.(v)}
            onFinalChange={(v) => onFinalChange?.(v)}
            renderTrack={({props, children}) => (
                <div
                    onMouseDown={props.onMouseDown}
                    onTouchStart={props.onTouchStart}
                    className="w-full rounded-full h-1"
                    {...props}
                    style={{
                    ...props.style,
                    background: getTrackBackground({
                        values: values,
                        colors: ["#ccc", color, "#ccc"],
                        min: min,
                        max: max
                    }),
                    }}
                >
                    {children}
                </div>
            )}
            renderThumb={({ index, props }) => (
                <div
                    className="relative w-4 h-4 rounded-full shadow-center shadow-black brightness-125 flex justify-center outline-none"
                    {...props}
                    style={{
                        ...props.style,
                        backgroundColor: color,
                        color: labelTextColor,
                    }}
                >
                    {renderLabel && renderLabel(values[index])}
                </div>
            )}
        />
    )
}
