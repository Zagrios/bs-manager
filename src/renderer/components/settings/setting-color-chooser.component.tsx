import { useRef, useState } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { motion, AnimatePresence } from "framer-motion"
import { useClickOutside } from "renderer/hooks/use-click-outside.hook";
import { BsmButton } from "../shared/bsm-button.component";

export default function SettingColorChooser({color, onChange, pickerClassName}: {color?: string, onChange?: (color: string) => void, pickerClassName?: string}) {

    const [colorVisible, setColorVisible] = useState(false);
    const ref = useRef(null);
    useClickOutside(ref, () => setColorVisible(() => false));

    return (
        <div ref={ref} className="relative cursor-pointer mx-3 h-full aspect-square flex flex-col items-center z-[1]">
            <span className="z-[1] block h-full w-full border-2 border-white rounded-full" onClick={() => setColorVisible(!colorVisible)} style={{backgroundColor: color}}/>
            <AnimatePresence>
                {colorVisible && 
                    <motion.div initial={{opacity: 0}} animate={{opacity: 1}} transition={{duration: .1}} exit={{opacity: 0}} className="absolute flex items-center grow-0 flex-col gap-2 justify-center translate-y-9 shadow-lg rounded-lg bg-light-main-color-3 dark:bg-main-color-3 shadow-black">
                        <div className="absolute h-2/4 aspect-square rotate-45 bg-light-main-color-3 dark:bg-main-color-3 -translate-y-12"/>
                        <HexColorPicker color={color} onChange={onChange}  className={`${pickerClassName}`} />
                        <div className="w-full max-w-full flex gap-2 px-1 pb-1">
                            <HexColorInput color={color} onChange={onChange} placeholder="#FFFFFF" className="grow w-12 text-center uppercase z-10 rounded-md bg-light-main-color-1 dark:bg-main-color-1 text-main-color-1 dark:text-light-main-color-3 outline-none" prefixed/>
                            <BsmButton className="grow shrink-0 rounded-md text-center" text="misc.apply" typeColor="primary" withBar={false} onClick={() => setColorVisible(() => false)}/>
                        </div>
                    </motion.div>
                }
            </AnimatePresence>
        </div>
    )
}
