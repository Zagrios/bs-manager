import { CSSProperties } from "react";
import { Supporter } from "shared/models/supporters";
import { motion } from "framer-motion";
import txtBg from "../../../../../assets/images/gifs/txt-bg.gif"

interface Props { supporter: Supporter, delay?: number }

export function SupporterItem({supporter, delay}: Props) {

    const additionnalStyles: CSSProperties = (() => {
        if(supporter.type === "gold"){ return {color: "#ffe270", textShadow: "0px 0px 10px #ffdd59", backgroundImage: `url(${txtBg})`, backgroundSize: "70% 15px", backgroundRepeat: "no-repeat", backgroundPosition: "center"}; }
        if(supporter.type === "diamond"){ return {color: "#e574fc", textShadow: "0px 0px 15px #e056fd", backgroundImage: `url(${txtBg})`, backgroundSize: "70% 19px", backgroundRepeat: "no-repeat", backgroundPosition: "center"}; }
        return {};
    })() 

    return (
        <motion.span className="text-2xl font-bold px-3 pb-1" style={additionnalStyles} initial={{y: "100%", opacity: 0}} animate={{y: 0, opacity: 1}} transition={{delay: delay}}>{supporter.username}</motion.span>
    )
}
