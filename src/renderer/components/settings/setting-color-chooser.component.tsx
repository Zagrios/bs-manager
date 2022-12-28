import { useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { motion, AnimatePresence } from "framer-motion"
import { useClickOutside } from "renderer/hooks/use-click-outside.hook";

export default function SettingColorChooser({color, onChange, pickerClassName}: {color?: string, onChange?: (color: string) => void, pickerClassName?: string}) {

    const [colorVisible, setColorVisible] = useState(false);
    const ref = useRef(null);
    useClickOutside(ref, (e) => setColorVisible(false));

    return (
        <div ref={ref} className="relative cursor-pointer mx-3 h-full aspect-square flex flex-col items-center">
            <span className="z-[1] block h-full w-full border-2 border-white rounded-full" onClick={() => setColorVisible(!colorVisible)} style={{backgroundColor: color}}/>
            <AnimatePresence>
                {colorVisible && 
                    <motion.div initial={{opacity: 0}} animate={{opacity: 1}} transition={{duration: .1}} exit={{opacity: 0}} className="fixed flex items-center justify-center translate-y-9 shadow-lg rounded-lg shadow-black">
                        <div className="absolute w-2/4 aspect-square rotate-45 bg-light-main-color-3 dark:bg-main-color-3 -translate-y-12"/>
                        <HexColorPicker color={color} onChange={onChange} className={pickerClassName} />
                    </motion.div>
                }
            </AnimatePresence>
        </div>
    )
}
