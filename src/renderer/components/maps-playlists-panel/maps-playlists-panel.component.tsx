import { useRef, useState } from "react";
import { BSVersion } from "shared/bs-version.interface";
import { LocalMapsListPanel } from "./maps/local-maps-list-panel.component";
import { BsmDropdownButton, DropDownItem } from "../shared/bsm-dropdown-button.component";
import { FilterPanel } from "./maps/filter-panel.component";
import { MapFilter } from "shared/models/maps/beat-saver.model";
import { MapsManagerService } from "renderer/services/maps-manager.service";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import { useService } from "renderer/hooks/use-service.hook";
import { BsContentTabPanel } from "../shared/bs-content-tab-panel/bs-content-tab-panel.component";
import { BsmButton } from "../shared/bsm-button.component";
import { MapIcon } from "../svgs/icons/map-icon.component";
import { PlaylistIcon } from "../svgs/icons/playlist-icon.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { of } from "rxjs";
import { LocalPlaylistsListPanel } from "./playlists/local-playlists-list-panel.component";
import { PlaylistsManagerService } from "renderer/services/playlists-manager.service";

type Props = {
    version?: BSVersion;
    isActive?: boolean;
};

export function MapsPlaylistsPanel({ version, isActive }: Props) {

    const mapsService = useService(MapsManagerService);
    const mapsDownloader = useService(MapsDownloaderService);
    const playlistsService = useService(PlaylistsManagerService);

    const t = useTranslation();
    const [tabIndex, setTabIndex] = useState(0);

    const mapsRef = useRef<any>();
    const [mapFilter, setMapFilter] = useState<MapFilter>({});
    const [mapSearch, setMapSearch] = useState("");
    const mapsLinkedState = useObservable(() => {
        if(!version) return of(FolderLinkState.Unlinked);
        return mapsService.$mapsFolderLinkState(version);
    }, FolderLinkState.Unlinked, [version]);

    const [playlistSearch, setPlaylistSearch] = useState("");
    const playlistLinkedState = useObservable(() => {
        if(!version) return of(FolderLinkState.Unlinked);
        return playlistsService.$playlistsFolderLinkState(version);
    }, FolderLinkState.Unlinked, [version]);


    const handleSearch = (value: string) => {
        if (tabIndex === 0) {
            return setMapSearch(() => value);
        }
        return setPlaylistSearch(() => value);
    };

    const handleMapsAddClick = () => {
        mapsDownloader.openDownloadMapModal(version, mapsRef.current.getMaps?.());
    };

    const handleMapsLinkClick = () => {
        if(mapsLinkedState === FolderLinkState.Pending || mapsLinkedState === FolderLinkState.Processing){ return Promise.resolve(false); }

        if (mapsLinkedState === FolderLinkState.Unlinked) {
            return mapsService.linkVersion(version);
        }

        return mapsService.unlinkVersion(version);
    };

    const dropDownItems = ((): DropDownItem[] => {
        if (tabIndex === 1) {
            return [];
        }
        return [
            { icon: "export", text: "pages.version-viewer.maps.search-bar.dropdown.export-maps", onClick: () => mapsRef.current.exportMaps?.() },
            { icon: "trash", text: "pages.version-viewer.maps.search-bar.dropdown.delete-maps", onClick: () => mapsRef.current.deleteMaps?.() },
        ];
    })();

    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <nav className="w-full shrink-0 flex h-9 justify-center px-40 gap-2 text-main-color-1 dark:text-white">
                <BsmButton
                    className="flex items-center justify-center w-fit rounded-full px-2 py-1 font-bold"
                    icon="add"
                    text="misc.add"
                    typeColor="primary"
                    withBar={false}
                    disabled={tabIndex === 1}
                    onClick={handleMapsAddClick}
                />
                <div className="h-full rounded-full bg-light-main-color-2 dark:bg-main-color-2 grow p-[6px]">
                    <input type="text" className="h-full w-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2" placeholder={t("pages.version-viewer.maps.search-bar.search-placeholder")} value={tabIndex === 0 ? mapSearch : playlistSearch} onChange={e => handleSearch(e.target.value)} tabIndex={-1} />
                </div>
                <BsmDropdownButton className="h-full relative z-[1] flex justify-center" buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1" icon="filter" text="pages.version-viewer.maps.search-bar.filters-btn" textClassName="whitespace-nowrap" withBar={false}>
                    <FilterPanel className="absolute top-[calc(100%+3px)] origin-top w-[500px] h-fit p-2 rounded-md shadow-md shadow-black" filter={mapFilter} onChange={setMapFilter} />
                </BsmDropdownButton>
                <BsmDropdownButton className="h-full flex aspect-square relative rounded-full z-[1] bg-light-main-color-1 dark:bg-main-color-3" buttonClassName="rounded-full h-full w-full p-[6px]" icon="three-dots" withBar={false} items={dropDownItems} menuTranslationY="6px" align="center" />
            </nav>
            <BsContentTabPanel
                tabIndex={tabIndex}
                onTabChange={index => setTabIndex(index)}
                tabs={[
                    {
                        text: "misc.maps",
                        icon: MapIcon,
                        onClick: () => setTabIndex(0),
                        linkProps: version ? {
                            state: mapsLinkedState,
                            onClick: handleMapsLinkClick,
                        } : null,
                    },
                    {
                        text: "misc.playlists",
                        icon: PlaylistIcon,
                        onClick: () => setTabIndex(1),
                        linkProps: version ? {
                            state: playlistLinkedState,
                            onClick: () => Promise.resolve(false),
                        } : null,
                    },
                ]}
            >
                <>
                    <LocalMapsListPanel isActive={isActive && tabIndex === 0} ref={mapsRef} className="w-full h-full shrink-0" version={version} filter={mapFilter} search={mapSearch} linkedState={mapsLinkedState} />
                    <LocalPlaylistsListPanel isActive={isActive && tabIndex === 1} version={version} linkedState={playlistLinkedState}/>
                </>
            </BsContentTabPanel>
        </div>
    );
}
