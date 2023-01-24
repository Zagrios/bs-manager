import { BsmIcon } from "../svgs/bsm-icon.component"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { getCorrectTextColor } from "renderer/helpers/correct-text-color"
import { GlowEffect } from "./glow-effect.component";
import { motion } from "framer-motion";
import { useState } from "react";

type Props = {className?:string, checked?: boolean, onChange?: (val: boolean) => void, disabled?: boolean}

export function BsmCheckbox({className, checked, onChange, disabled} : Props) {

    const [hovered, setHovered] = useState(false);
    const checkedColor = useThemeColor("first-color");
    const iconColor = getCorrectTextColor(checkedColor);

    const handleClick = () => {
        if(disabled){ return; }
        onChange && onChange(!checked);
    }

    return (
        <motion.div className={`${className} group-one`} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}>
            <GlowEffect visible={!disabled && hovered} className="!w-[calc(100%+6px)] !h-[calc(100%+6px)] !-top-[3px] !-left-[3px]"/>

            <span className={`w-full h-full flex items-center justify-center rounded-md border-2 border-current overflow-hidden bg-light-main-color-3 dark:bg-main-color-1 ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`} onClickCapture={e => {e.stopPropagation(); handleClick()}}>
                <BsmIcon className="w-full h-full" icon="check" style={{color: iconColor, backgroundColor: checkedColor, visibility: checked ? "visible" : "hidden"}}/>
            </span>
        </motion.div>
  )
}
