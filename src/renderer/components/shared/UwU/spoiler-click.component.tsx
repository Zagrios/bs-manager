import {motion, useCycle} from "framer-motion"
import { useState } from "react"

type Props = {className?: string, nbClickToShow?: number, children?: JSX.Element}

export function SpoilerClick({className, children, nbClickToShow = 5}: Props) {

    const [remainingClicks, setRemainingClicks] = useState(nbClickToShow);
    const [translateY, setTranslateY] = useState("100%");

    const handleClicks = () => {
        if(remainingClicks - 1 > 0){ setRemainingClicks(nb => nb - 1); }
        setTranslateY(`${(((remainingClicks - 1) / nbClickToShow) * 100)}%`)
    }

    return (
        <motion.div className={className} initial={{y: translateY}} animate={{y: translateY}} transition={{type: "spring", stiffness: 300, mass: 1 }} onClick={handleClicks}>
            {children}
        </motion.div>
    )
}
