import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { motion, AnimatePresence } from "framer-motion"
import OutsideClickHandler from "react-outside-click-handler";

export default function SettingColorChooser({color, onChange}: {color?: string, onChange?: (color: string) => void}) {

    const [colorVisible, setColorVisible] = useState(false);

  return (
    <OutsideClickHandler onOutsideClick={() => setColorVisible(false)}>
        <div className="relative cursor-pointer mx-3 h-full aspect-square flex flex-col items-center">
            <span className="z-[1] block h-full w-full border-2 border-white rounded-full" onClick={() => setColorVisible(!colorVisible)} style={{backgroundColor: color}}/>
            <AnimatePresence>
                {colorVisible && 
                    <motion.div initial={{opacity: 0}} animate={{opacity: 1}} transition={{duration: .1}} exit={{opacity: 0}} className="absolute flex items-center justify-center translate-y-9 shadow-lg rounded-lg shadow-black">
                        <div className="absolute w-2/4 aspect-square rotate-45 bg-main-color-3 -translate-y-12"></div>
                        <HexColorPicker color={color} onChange={onChange} className="" />
                    </motion.div>
                }
            </AnimatePresence>
        </div>
    </OutsideClickHandler>
  )
}
