import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BsManagerIcon } from "../components/nav-bar/bsmanager-icon.component";
import { BsmProgressBar } from "../components/progress-bar/bsm-progress-bar.component";
import TitleBar from "../components/title-bar/title-bar.component";
import { useTranslation } from "../hooks/use-translation.hook";
import { AutoUpdaterService } from "../services/auto-updater.service";
import { ThemeService } from "../services/theme.service";
import { WindowManagerService } from "../services/window-manager.service";

export default function Launcher() {

    const themeService = ThemeService.getInstance();
    const updaterService = AutoUpdaterService.getInstance();
    const windowService = WindowManagerService.getInstance();

    const constraintsRef = useRef(null);

    const [text, setText] = useState("auto-update.checking");

    const t = useTranslation();


    useEffect(() => {

        const sub = themeService.theme$.subscribe(() => {
            if(themeService.isDark || (themeService.isOS && window.matchMedia('(prefers-color-scheme: dark)').matches)){ document.documentElement.classList.add('dark'); }
            else { document.documentElement.classList.remove('dark'); }
        });

        updaterService.isUpdateAvailable().then(available => {
            if(!available){ return windowService.openThenCloseAll("index.html"); }
            setText("auto-update.downloading");
            updaterService.downloadUpdate().then(installed => {
                if(!installed){ return windowService.openThenCloseAll("index.html"); }
                updaterService.quitAndInstall()
            });
        });

        return () => sub.unsubscribe();
    }, []);

    return (
        <div className="w-full h-full">
            <TitleBar template="launcher.html"/>
            <div className="relative flex flex-col items-center justify-center pt-10">
                <motion.div ref={constraintsRef}>
                    <motion.div drag dragConstraints={constraintsRef} animate={{rotate: [0, 10, 0]}} transition={{ duration: .6, repeat: Infinity, repeatDelay: 1.6 }}>
                        <BsManagerIcon className={"w-52 cursor-pointer"}/>
                    </motion.div>
                </motion.div>
                <span className="relative text-lg mt-16 mb-24 uppercase italic text-main-color-1 dark:text-gray-200">{t(text)}</span>
                <BsmProgressBar/>
            </div>
        </div>
    )
}
