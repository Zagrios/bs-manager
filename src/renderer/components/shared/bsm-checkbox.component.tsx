import { BsmIcon } from "../svgs/bsm-icon.component"
import { motion } from "framer-motion"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { getCorrectTextColor } from "renderer/helpers/correct-text-color"

type Props = {className?:string, checked?: boolean, onChange?: (val: boolean) => void, disabled?: boolean}

export function BsmCheckbox({className, checked, onChange, disabled} : Props) {
    
    const checkedColor = useThemeColor("first-color");
    const iconColor = getCorrectTextColor(checkedColor);

    const handleClick = () => {
        if(disabled){ return; }
        onChange && onChange(!checked);
    }

    return (
        <div className={`group ${className}`}>
            {!disabled && <div className="glow-on-hover !w-[calc(100%+6px)] !h-[calc(100%+6px)] !-top-[3px] !-left-[3px] group-hover:opacity-100"/>}
            
            <div className={`w-full h-full bg-inherit border-2 border-current rounded-md overflow-hidden flex items-center justify-center ${disabled ? "brightness-50 cursor-not-allowed" : "cursor-pointer"}`} onClickCapture={e => {e.stopPropagation(); handleClick()}}>
                <motion.span className="w-full h-full flex items-center justify-center" style={{backgroundColor: checkedColor}} initial={checked ? {opacity: 1} : {opacity: 0}} animate={checked ? {opacity: 1} : {opacity: 0}} transition={{duration: .15}}>
                    <BsmIcon icon="check" style={{color: iconColor}}/>
                </motion.span>
            </div>
        </div>
  )
}
