import { BsmIcon } from "../svgs/bsm-icon.component"
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
        <div className={`group ${className}`} onClickCapture={e => {e.stopPropagation(); handleClick()}}>
            {!disabled && <span className="glow-on-hover !w-[calc(100%+6px)] !h-[calc(100%+6px)] !-top-[3px] !-left-[3px] group-hover:opacity-100"/>}
            
            <span className={`w-full h-full flex items-center justify-center rounded-md border-2 border-current overflow-hidden bg-light-main-color-3 dark:bg-main-color-1 ${disabled ? "brightness-50 cursor-not-allowed" : "cursor-pointer"}`}>
                <BsmIcon className="w-full h-full" icon="check" style={{color: iconColor, backgroundColor: checkedColor, visibility: checked ? "visible" : "hidden"}}/>
            </span>
        </div>
  )
}
