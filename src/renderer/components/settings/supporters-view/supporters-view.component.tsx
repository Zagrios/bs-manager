import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component"
import { Supporter } from "shared/models/supporters";
import { SupportersService } from "renderer/services/supporters.service";
import { SupportersBlock } from "./supporters-block.component";
import ManheraChanGif from "../../../../../assets/images/gifs/menhera-chan.gif"
import ManheraSadGif from "../../../../../assets/images/gifs/menhera-sad.gif"
import { useTranslation } from "renderer/hooks/use-translation.hook";

interface Props {isVisible: boolean, setVisible: (b: boolean) => void}

export function SupportersView({isVisible, setVisible}: Props) {

    const supportersService = SupportersService.getInstance();
    const t = useTranslation();

    const [supporters, setSupporters] = useState([] as Supporter[]);
    const [sponsors, setSponsors] = useState([] as Supporter[]);

    useEffect(() => {
        if(isVisible){
            supportersService.getSupporters().then(supporters => {
                setSponsors(supporters.filter(s => s.type === "sponsor"));
                setSupporters(supporters.filter(s => !s.type || s.type !== "sponsor"));
            });
        }
    }, [isVisible])
    

    return (
        <AnimatePresence>
            ({isVisible && 
                <motion.div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-90 z-40 text-gray-200" transition={{duration: .3}} initial={{opacity: 0, y: "-100%"}} animate={{opacity: 1, y: "0%"}} exit={{opacity: 0, y: "-100%"}}>
                    <BsmButton className="absolute right-10 top-10 !bg-transparent w-7 h-7" icon="cross" withBar={false} onClick={() => setVisible(false)}/>
                    {(!!sponsors.length || !!supporters.length) && <img className="absolute bottom-5 right-5 rotate-45 w-32 h-32" src={ManheraChanGif}/>}
                    <div className="w-full h-full overflow-y-scroll">
                        {!!sponsors.length && <SupportersBlock className="mt-12" title="pages.settings.patreon.view.sponsors" supporters={sponsors}/>}
                        {!!supporters.length && <SupportersBlock className="mt-12" title="pages.settings.patreon.view.supporters" supporters={supporters}/>}
                        {(!sponsors.length && !supporters.length) && (
                            <>
                                <h2 className="w-full text-center text-3xl font-bold mt-10 mb-24">{t("pages.settings.patreon.view.no-supporters")}</h2>
                                <img className="m-auto" src={ManheraSadGif} />
                            </>
                        )}
                    </div>
                </motion.div>
            })
        </AnimatePresence>
    )
}
