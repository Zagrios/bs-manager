import { useEffect, useState } from "react"
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { AnimatePresence, motion } from "framer-motion";
import BeatRunningImg from "../../../../assets/beat-running.png"
import BeatWaitingImg from "../../../../assets/beat-waiting.png"

export function BsmProgressBar() {

    const progressBarService = ProgressBarService.getInstance();

    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      
        const progressSub = progressBarService.progression$.subscribe(val => setProgress(val));
        const visibleSub = progressBarService.visible$.subscribe(state => setVisible(state));
        
        return () => {
            progressSub.unsubscribe();
            visibleSub.unsubscribe();
        }
    }, [])
    

  return (
    <AnimatePresence> { visible && 
        <motion.div initial={{y: "120%"}} animate={{y:"0%"}} exit={{y:"120%"}} className="w-full absolute h-14 flex justify-center items-center bottom-2">
            <div className={`flex items-center content-center justify-center bottom-9 z-10 rounded-lg bg-main-color-2 shadow-center shadow-black cursor-pointer transition-all duration-300 ${!progress && "h-14 w-14 rounded-full"} ${!!progress && "h-5 w-3/4 rounded-full p-[6px]"}`}>
            { !!progress && (
            <>
                <div className="relative flex items-center h-full w-full rounded-full bg-black">
                    <div className="w-0 h-full relative rounded-full download-progress flex items-center transition-all" style={{width: `${progress}%`}}>
                        <img className="h-[70px] w-[70px] min-w-fit absolute z-[1] -translate-y-1 -right-8 transition-all" src={BeatRunningImg} />
                    </div>
                    <span className="absolute w-full text-center text-white -top-[3px] left-0 text-[10px]">{`${progress}%`}</span>
                </div>
            </>
            )}
            { !progress && <img className="w-12 h-12 spin-loading" src={BeatWaitingImg}></img> }
        </div>
        </motion.div>
    } </AnimatePresence>
  )
}
