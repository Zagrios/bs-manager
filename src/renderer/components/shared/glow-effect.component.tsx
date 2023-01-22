import { AnimatePresence, motion } from "framer-motion"

type Props = {
    visible?: boolean,
    className?: string
}

export function GlowEffect({visible, className}: Props) {
    return (
        <AnimatePresence>
            {visible && <motion.div transition={{duration: .1}} initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className={`${className} glow-on-hover`}/>}
        </AnimatePresence>
    )
}
