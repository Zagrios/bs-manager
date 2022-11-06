import { useState } from "react"
import { useObservable } from "renderer/hooks/use-observable.hook"
import { MapsManagerService } from "renderer/services/maps-manager.service"
import { BSVersion } from "shared/bs-version.interface"
import { TabNavBar } from "../shared/tab-nav-bar.component"

type Props = {
    oneBlock?: boolean,
    version?: BSVersion
}

export function MapsPlaylistsPanel({version, oneBlock = false}: Props) {

    const mapsManager = MapsManagerService.getInstance();
    
    const [tabIndex, setTabIndex] = useState(0);
    const maps = useObservable(mapsManager.getMaps(version));

    console.log(maps);

    return (
        <>
        {!oneBlock && <TabNavBar className="mb-8 w-72" tabsText={["Maps", "Playlists"]} onTabChange={setTabIndex}/>}
        <div className="w-full h-full bg-main-color-1 rounded-md shadow-black shadow-md overflow-hidden">
            {oneBlock && <TabNavBar className="!rounded-none shadow-sm" tabsText={["Maps", "Playlists"]} onTabChange={setTabIndex}/>}
            <div className="w-full h-full min-h-0 flex flex-row items-center transition-transform duration-300" style={{transform: `translate(${-(tabIndex * 100)}%, 0)`}}>
                <div className="w-full h-full grow bg-red-300 shrink-0 overflow-y-scroll">
                    a
                </div>
                <div className="w-full h-full grow bg-green-300 shrink-0">b</div>
            </div>
        </div> 
        </>
    )
}
