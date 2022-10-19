import { useState } from "react"
import { BsmIconType } from "../svgs/bsm-icon.component"
import { BsmButton } from "./bsm-button.component"
import { BsmIcon } from "../svgs/bsm-icon.component"
import { useTranslation } from "renderer/hooks/use-translation.hook"

export interface DropDownItem {text: string, icon?: BsmIconType, onClick?: () => void}

type Props = {className?: string, items?: DropDownItem[], align?: "left"|"right", withBar?: boolean, icon?: BsmIconType, buttonClassName?: string, menuTranslationY?: string|number}

export function BsmDropdownButton({className, items, align, withBar = true, icon = "settings", buttonClassName, menuTranslationY}: Props) {

   const [expanded, setExpanded] = useState(false)
   const t = useTranslation();

   const defaultButtonClassName = "relative z-[1] p-1 rounded-md text-inherit w-full h-full shadow-md shadow-black"

   return (
      <div className={`${className}`}>
         <BsmButton onClick={() => setExpanded(!expanded)} className={buttonClassName ?? defaultButtonClassName} icon={icon} active={expanded} onClickOutside={() => {setExpanded(false)}} withBar={withBar}/>
         <div className={`py-1 w-fit absolute cursor-pointer top-[calc(100%-4px)] rounded-md bg-inherit text-sm text-gray-800 dark:text-gray-200 shadow-md shadow-black transition-[scale] ease-in-out ${align === "left" ? "left-0 origin-top-left" : "right-0 origin-top-right"}`} style={{scale: expanded ? "1" : "0", translate: `0 ${menuTranslationY}`}}>
            { items?.map((i, index) => !!i &&(
               <div key={index} onClick={!!i.onClick ? i.onClick : undefined} className="flex w-full px-3 py-2 hover:backdrop-brightness-150">
                  {i.icon && <BsmIcon icon={i.icon} className="h-5 w-5 mr-1 text-inherit"></BsmIcon>}
                  <span className="w-max">{t(i.text)}</span>
               </div>
            ))}
         </div>
      </div>
  )
}
