import { MapsPlaylistsPanel } from "renderer/components/maps-mangement-components/maps-playlists-panel.component";
import { Slideshow } from "renderer/components/slideshow/slideshow.component";

export function MapsPage() {
    return (
        <div className="w-full h-full flex items-center flex-col pt-2">
            <Slideshow className="absolute w-full h-full top-0"/>
            <h1 className="text-gray-100 text-2xl z-[1]">Maps partagées</h1>
            <div className="w-full min-h-0 grow p-10 flex flex-col items-center justify-start text-white relative">
                <MapsPlaylistsPanel/>
            </div>
        </div>
    )
}
