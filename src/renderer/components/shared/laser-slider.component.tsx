import { CSSProperties } from "react";
import { cn } from "renderer/helpers/css-class.helpers";

type Props = Readonly<{
    mode: "horizontal" | "vertical";
    color: string;
    className?: string;
    nbSteps: number;
    step: number;
}>

export function LaserSlider({mode, color, className, nbSteps, step}: Props) {

    const sliderStyle = ((): CSSProperties => {
        if(mode === "vertical"){
            return {
                transform: `translate(0, ${step * 100}%)`,
                height: `calc(100% / ${nbSteps})`,
                width: "100%"
            }
        }

        return {
            transform: `translate(${step * 100}%, 0)`,
            width: `calc(100% / ${nbSteps})`,
            height: "100%"
        }
    })();

    return (
        <div className={cn("relative", className)} style={{ color }}>
            <span className="absolute h-full w-full bg-current brightness-50" />
            <span className="absolute block bg-current transition-transform duration-300 shadow-center shadow-current" style={sliderStyle} />
        </div>
    )
}
