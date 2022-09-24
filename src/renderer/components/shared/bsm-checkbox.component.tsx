import { useState } from "react"
import { BsmIcon } from "../svgs/bsm-icon.component"
import { motion } from "framer-motion"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useBestTextColor } from "renderer/hooks/use-best-text-color.hook";

type Props = {className?:string, checked?: boolean, onChange?: (val: boolean) => void, disabled?: boolean}

export function BsmCheckbox({className, checked, onChange, disabled} : Props) {

    const [isChecked, setIsChecked] = useState(true);
    const checkedColor = useThemeColor("first-color");
    const iconColor = useBestTextColor(checkedColor);

    const handleClick = () => {
        if(disabled){ return; }
        onChange && onChange(!checked);
        setIsChecked(val => !val);
    }

    return (
        <div className={`group ${className}`}>
            {!disabled && <div className="glow-on-hover !w-[calc(100%+6px)] !h-[calc(100%+6px)] !-top-[3px] !-left-[3px] group-hover:opacity-100"/>}
            
            <div className={`w-full h-full bg-inherit border-2 rounded-md overflow-hidden flex items-center justify-center relative ${disabled ? "brightness-75 cursor-not-allowed" : "cursor-pointer"}`} onClick={handleClick}>
                <motion.span className="absolute w-full h-full flex items-center justify-center" style={{backgroundColor: checkedColor}} initial={isChecked ? {scale: 1} : {scale: 0}} animate={isChecked ? {scale: 1} : {scale: 0}} transition={{duration: .1}}>
                    <BsmIcon icon="check" style={{color: iconColor}}/>
                </motion.span>
            </div>
        </div>
  )
}
