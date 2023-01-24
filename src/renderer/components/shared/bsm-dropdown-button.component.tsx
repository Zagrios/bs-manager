import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { BsmIconType, BsmIcon } from "../svgs/bsm-icon.component"
import { BsmButton } from "./bsm-button.component"
import { useTranslation } from "renderer/hooks/use-translation.hook"
import { AnimatePresence } from "framer-motion"
import { useClickOutside } from "renderer/hooks/use-click-outside.hook"

export interface DropDownItem {text: string, icon?: BsmIconType, onClick?: () => void}

type Props = {
    className?: string, 
    items?: DropDownItem[], 
    align?: "left"|"right"|"center", 
    withBar?: boolean, 
    icon?: BsmIconType, 
    buttonClassName?: string, 
    menuTranslationY?: string|number
    children?: JSX.Element,
    text?: string,
}

export const BsmDropdownButton = forwardRef(({className, items, align, withBar = true, icon = "settings", buttonClassName, menuTranslationY, children, text}: Props, fowardRed) => {

   const [expanded, setExpanded] = useState(false)
   const t = useTranslation();
   const ref = useRef(fowardRed)
   useClickOutside(ref, () => setExpanded(false));

   useImperativeHandle(fowardRed, () => ({
        close(){
            setExpanded(() => false);
       },
        open(){
            setExpanded(() => true);
        }
     }),
     [],
   )
   

   const defaultButtonClassName = "relative z-[1] p-1 rounded-md text-inherit w-full h-full shadow-md shadow-black"

   const handleClickOutside = () => {
        if(children){ return; }
        setExpanded(false);
   }

   const alignClass = (() => {
        if(align === "center"){ return "right-1/2 origin-top-right translate-x-[50%]" }
        if(align === "left"){ return "left-0 origin-top-left"; }
        return "right-0 origin-top-right";
   })()

   return (
        // @ts-ignore
      <div ref={ref} className={className}>
         <BsmButton onClick={() => setExpanded(!expanded)} className={buttonClassName ?? defaultButtonClassName} icon={icon} active={expanded} onClickOutside={handleClickOutside} withBar={withBar} text={text}/>
         <div className={`py-1 w-fit absolute cursor-pointer top-[calc(100%-4px)] rounded-md bg-inherit text-sm text-gray-800 dark:text-gray-200 shadow-md shadow-black transition-[scale] ease-in-out ${alignClass}`} style={{scale: expanded ? "1" : "0", translate: `0 ${menuTranslationY}`}}>
            { items?.map((i) => i && (
               <div key={crypto.randomUUID()} onClick={() => i.onClick?.()} className="flex w-full px-3 py-2 hover:backdrop-brightness-150">
                  {i.icon && <BsmIcon icon={i.icon} className="h-5 w-5 mr-1 text-inherit"/>}
                  <span className="w-max">{t(i.text)}</span>
               </div>
            ))}
         </div>
         {!!children && (
            <AnimatePresence>
                {expanded && (
                    children
                )}
            </AnimatePresence>
         )}
      </div>
  )
})
