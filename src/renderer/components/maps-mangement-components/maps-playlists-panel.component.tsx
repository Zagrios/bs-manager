import { useState } from "react"
import { MapsManagerService } from "renderer/services/maps-manager.service"
import { BSVersion } from "shared/bs-version.interface"
import { TabNavBar } from "../shared/tab-nav-bar.component"

type Props = {
    version?: BSVersion
}

export function MapsPlaylistsPanel({version}: Props) {

    const [tabIndex, setTabIndex] = useState(0);

    console.log(tabIndex);

    return (
        <div className="w-full h-full bg-main-color-1 rounded-md shadow-black shadow-md overflow-hidden">
            <TabNavBar className="!rounded-none shadow-sm" tabsText={["Maps", "Playlists"]} onTabChange={setTabIndex}/>
            <div className="w-full h-full flex flex-row items-center transition-transform duration-300" style={{transform: `translate(${-(tabIndex * 100)}%, 0)`}}>
                <div className="w-full h-full grow bg-red-300 shrink-0">a</div>
                <div className="w-full h-full bg-green-300 shrink-0">b</div>
            </div>
        </div> 
    )
}
