import { BSVersion } from "shared/bs-version.interface"
import { TabNavBar } from "../shared/tab-nav-bar.component"

type Props = {
    version?: BSVersion
}

export function MapsPlaylistsPanel({version}: Props) {
    return (
        <div className="w-full h-full bg-main-color-1 rounded-md shadow-black shadow-md overflow-hidden">
            <TabNavBar className="!rounded-none shadow-none" tabsText={["Maps", "Playlists"]} onTabChange={() => {}}/>
        </div>
    )
}
