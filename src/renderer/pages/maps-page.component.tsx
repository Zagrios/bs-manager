import { MapsPlaylistsPanel } from "renderer/components/maps-mangement-components/maps-playlists-panel.component";
import { Slideshow } from "renderer/components/slideshow/slideshow.component";

export default function MapsPage() {
    return (
        <div className="w-full h-full flex items-center flex-col pt-2">
            <Slideshow className="absolute w-full h-full top-0"/>
            <h1 className="text-gray-100 text-2xl mb-4 z-[1]">Maps partagées</h1>
            <div className="z-[1] w-full grow p-10">
                <MapsPlaylistsPanel/>
            </div>
        </div>
    )
}
