import { useState } from "react"
import { BsmIconType } from "../svgs/bsm-icon.component"
import { BsmButton } from "./bsm-button.component"
import { BsmIcon } from "../svgs/bsm-icon.component"

export interface DropDownItem {id: number, text: string, icon?: BsmIconType}

export function BsmDropdownButton({className, items, align, onItemClick}: {className?: string, items?: DropDownItem[], align?: "left"|"right", onItemClick?: (id: number) => void}) {

    const [expanded, setExpanded] = useState(false)

  return (
    <div className={`${className}`}>
        <BsmButton onClick={() => setExpanded(!expanded)} className='relative bg-light-main-color-2 dark:bg-main-color-2 z-[1] p-1 rounded-md text-inherit w-full h-full shadow-md shadow-black' icon="settings" active={expanded} onClickOutside={() => {setExpanded(false)}}/>
        <div className={`pt-1 pb-1 w-fit absolute cursor-pointer top-[calc(100%-4px)] rounded-md overflow-hidden bg-light-main-color-2 dark:bg-main-color-2 text-sm text-gray-800 dark:text-gray-200 shadow-md shadow-black transition-transform ease-in-out ${align === "left" ? "left-0 origin-top-left" : "right-0 origin-top-right"}`} style={{transform: expanded ? "scale(1)" : "scale(0)"}}>
            { items?.map(i => 
                <div key={i.id} onClick={() => onItemClick(i.id)} className="flex justify-start items-center w-full pr-3 pl-3 pt-2 pb-2 hover:bg-light-main-color-3 dark:hover:bg-main-color-3">
                    {i.icon && <BsmIcon icon={i.icon} className="h-5 w-5 mr-1 text-gray-800 dark:text-white"></BsmIcon>}
                    <span className="w-max">{i.text}</span>
                </div>
            )}
        </div>
    </div>
  )
}
