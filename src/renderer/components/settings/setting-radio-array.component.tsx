import { motion } from "framer-motion"
import { BsmIcon, BsmIconType } from "../svgs/bsm-icon.component"

export function SettingRadioArray({items, selectedItem = items[0].id, onItemSelected}: {items: RadioItem[], selectedItem?: number, onItemSelected?: (id: number) => void}) {

  return (
    <div className="w-full">
        { items.map(i => (
            <div onClick={() => onItemSelected(i.id)} key={i.id} className={`py-3 my-[6px] w-full flex justify-between items-center rounded-md px-2 transition-colors duration-200 ${i.id === selectedItem ? "bg-main-color-3" : "bg-main-color-1"}`}>
                <div className="flex items-center">
                    <div className="h-5 rounded-full aspect-square border-2 border-white p-[3px] mr-2">
                        <motion.span initial={{scale: 0}} animate={{scale: i.id === selectedItem ? 1 : 0}} className="h-full w-full block bg-white rounded-full"/>
                    </div>
                    <h2 className="font-extrabold">{i.text}</h2>
                </div>
                {i.icon && (
                    <>
                        <div className="flex items-center">
                            {i.textIcon && <span>{i.textIcon}</span>}
                        </div>
                        <BsmIcon icon={i.icon}/>
                    </>
                )}
            </div>
        )) }
    </div>
  )
}

export interface RadioItem { id: number, text: string, icon?: BsmIconType, textIcon?: string }
