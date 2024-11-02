import { useState } from "react";
import { LeaderboardPanel } from "renderer/components/leaderboard/leaderboard-panel.component";
import { MapsPlaylistsPanel } from "renderer/components/maps-playlists-panel/maps-playlists-panel.component";
import { ModelsPanel } from "renderer/components/models-management/models-panel.component";
import { TabNavBar } from "renderer/components/shared/tab-nav-bar.component";
import { Slideshow } from "renderer/components/slideshow/slideshow.component";

// TODO: Update locales and isActive
export function SharedContentsPage() {

    const MAPS_INDEX = 0;
    const MODELS_INDEX = 1;
    // const RANK_INDEX = 2;

    const [tabIndex, setTabIndex] = useState(0);

    return (
        <div className="relative flex items-center flex-col w-full h-full text-gray-200 backdrop-blur-lg">
            <Slideshow className="absolute w-full h-full top-0" />
            <TabNavBar className="my-4" tabIndex={tabIndex} tabsText={["misc.maps", "misc.models", "Rank"]} onTabChange={setTabIndex} />
            <div className="w-full min-h-0 grow flex transition-transform duration-300" style={{ transform: `translate(${-(tabIndex * 100)}%, 0)` }}>
                <div className="w-full shrink-0 px-3 pb-3 flex flex-col items-center">
                    <MapsPlaylistsPanel isActive={tabIndex === MAPS_INDEX} />
                </div>
                <div className="w-full shrink-0 px-3 pb-3 flex flex-col items-center">
                    <ModelsPanel isActive={tabIndex === MODELS_INDEX} />
                </div>
                <div className="w-full shrink-0 px-3 pb-3 flex flex-col items-center">
                    <LeaderboardPanel />
                </div>
            </div>
        </div>
    );
}
