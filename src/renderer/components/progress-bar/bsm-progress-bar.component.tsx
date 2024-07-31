import { ProgressBarService } from "renderer/services/progress-bar.service";
import { AnimatePresence, motion } from "framer-motion";
import BeatRunningImg from "../../../../assets/images/apngs/beat-running.png";
import BeatWaitingImg from "../../../../assets/images/apngs/beat-waiting.png";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useService } from "renderer/hooks/use-service.hook";

export function BsmProgressBar() {
    const progressBarService = useService(ProgressBarService);

    const progressData = useObservable(() => progressBarService.progressData$);
    const visible = useObservable(() => progressBarService.visible$);
    const style = useObservable(() => progressBarService.style$);

    const progressLabel = (() => {
        if (!progressData) {
            return "";
        }
        if (progressData?.label) {
            return progressData.label;
        }
        return `${Math.floor(progressData.progression)}%`;
    })();
    const progressValue: number = progressData?.progression;

    const { firstColor, secondColor } = useThemeColor();

    return (
        <AnimatePresence>
            {" "}
            {visible && (
                <motion.div initial={{ y: "120%" }} animate={{ y: "0%" }} exit={{ y: "120%" }} className="w-full absolute h-14 flex justify-center items-center bottom-2 pointer-events-none z-[10000]" style={style}>
                    <div className={`flex items-center content-center justify-center bottom-9 z-10 rounded-full bg-light-main-color-2 dark:bg-main-color-2 shadow-center shadow-black transition-all duration-300 ${!progressValue && "h-14 w-14 "} ${!!progressValue && "h-5 w-3/4 p-[6px]"}`}>
                        {!!progressValue && (
                            <div className="relative h-full w-full rounded-full bg-black">
                                <div className="w-0 h-full relative rounded-full download-progress flex items-center transition-all" style={{ width: `${progressValue}%`, background: `linear-gradient(90deg, ${firstColor}, ${secondColor}, ${firstColor}, ${secondColor})` }}>
                                    <img className="h-[70px] w-[70px] min-w-fit absolute z-[1] -translate-y-1 -right-8" src={BeatRunningImg} />
                                </div>
                                <span className="absolute w-full text-center text-white -top-[3px] left-0 text-[10px]">{progressLabel}</span>
                            </div>
                        )}
                        {!progressValue && <img className="w-12 h-12 spin-loading" src={BeatWaitingImg} />}
                    </div>
                </motion.div>
            )}{" "}
        </AnimatePresence>
    );
}
