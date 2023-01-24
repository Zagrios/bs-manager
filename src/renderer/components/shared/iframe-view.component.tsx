import { AnimatePresence, motion } from "framer-motion";
import { useRef } from "react";
import { useClickOutside } from "renderer/hooks/use-click-outside.hook";
import { useObservable } from "renderer/hooks/use-observable.hook"
import { LinkOpenerService } from "renderer/services/link-opener.service";

export function BsmIframeView() {

    const linkService = LinkOpenerService.getInstance()

    const iframeUrl = useObservable(linkService.iframeLink$);
    const ref = useRef(null);
    useClickOutside(ref, () => linkService.closeIframe());

    return (
        <AnimatePresence>
            {iframeUrl && (
                <div className="top-0 absolute w-screen h-screen flex content-center items-center justify-center z-[150]">
                    <motion.span className="absolute w-full h-full bg-black top-0 right-0" initial={{opacity: 0}} animate={{opacity: .60}} exit={{opacity: 0}} transition={{duration: .2}}/>
                    <motion.div ref={ref} className="z-[1] w-[calc(100vw-250px)] h-[calc(100vh-250px)] shadow-black shadow-md rounded-md overflow-hidden bg-black" initial={{y: "100vh"}} animate={{y: 0}} exit={{y: "100vh"}}>
                        <iframe className="w-full h-full" src={iframeUrl}/>
                    </motion.div>
                </div>
            )}
            
        </AnimatePresence>
    )
}
