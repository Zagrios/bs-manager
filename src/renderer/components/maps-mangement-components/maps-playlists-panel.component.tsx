import { useState } from "react"
import { BSVersion } from "shared/bs-version.interface"
import { TabNavBar } from "../shared/tab-nav-bar.component"
import { BsmIcon } from "../svgs/bsm-icon.component"
import { LocalMapsListPanel } from "./local-maps-list-panel.component"
import {AnimatePresence, motion} from "framer-motion"

type Props = {
    oneBlock?: boolean,
    version?: BSVersion
}

export function MapsPlaylistsPanel({version, oneBlock = false}: Props) {
    
    const [tabIndex, setTabIndex] = useState(0);

    return (
        <>
        {!oneBlock && <TabNavBar className="mb-8 w-72" tabsText={["Maps", "Playlists"]} onTabChange={setTabIndex}/>}
        <div className="w-full h-full flex flex-col items-center justify-center">
            <nav className="w-full shrink-0 flex h-9 justify-center px-40 gap-2 mb-3">
                <motion.div layout className="h-full rounded-full bg-main-color-2 grow flex items-center gap-1 px-2">
                    <input type="text" name="" id="" className="bg-main-color-1 rounded-full grow px-2" placeholder="Rechercher" />
                    <BsmIcon className="h-full w-fit py-1" icon="trash"/>
                </motion.div>
                <AnimatePresence mode="popLayout">
                    {tabIndex === 0 && (
                        <motion.div layout className="h-full rounded-full bg-main-color-2 flex justify-center items-center px-2" initial={{scale: tabIndex === 0 ? 1 : 0}} animate={{scale: tabIndex === 0 ? 1 : 0}} exit={{scale: 0}}>
                            <BsmIcon className="h-full w-fit py-1" icon="trash"/>
                            <span>Filtres</span>
                        </motion.div>
                    )}
                </AnimatePresence>
                
            </nav>
            <div className="w-full h-full flex flex-col bg-main-color-2 rounded-md shadow-black shadow-md overflow-hidden">
                {oneBlock && <TabNavBar className="!rounded-none shadow-sm" tabsText={["Maps", "Playlists"]} onTabChange={setTabIndex}/>}
                <div className="w-full grow min-h-0 flex flex-row items-center transition-transform duration-300" style={{transform: `translate(${-(tabIndex * 100)}%, 0)`}}>
                    <LocalMapsListPanel className="w-full h-full shrink-0 flex flex-col" version={version}/>
                <div className="w-full h-full grow shrink-0">b</div>
            </div>
        </div> 

        </div>
        
        </>
    )
}
