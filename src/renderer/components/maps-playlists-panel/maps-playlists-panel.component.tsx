import { createContext, useRef, useState } from "react";
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
import { BehaviorSubject, of } from "rxjs";
import { LocalPlaylistsListPanel, LocalPlaylistsListRef } from "./playlists/local-playlists-list-panel.component";
import { PlaylistsManagerService } from "renderer/services/playlists-manager.service";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { PlaylistDownloaderService } from "renderer/services/playlist-downloader.service";
import { LocalPlaylistFilter, LocalPlaylistFilterPanel } from "./playlists/local-playlist-filter-panel.component";
import { noop } from "shared/helpers/function.helpers";

type Props = {
    readonly version?: BSVersion;
    readonly isActive?: boolean;
};

export const InstalledMapsContext = createContext<{
    maps$: BehaviorSubject<BsmLocalMap[]>;
    setMaps: (maps: BsmLocalMap[]) => void;
    playlists$: BehaviorSubject<LocalBPListsDetails[]>;
    setPlaylists: (playlist: LocalBPListsDetails[]) => void;
}>(null);

export function MapsPlaylistsPanel({ version, isActive }: Props) {

    const mapsManager = useService(MapsManagerService);
    const mapsDownloader = useService(MapsDownloaderService);
    const playlistsManager = useService(PlaylistsManagerService);
    const playlistsDownloader = useService(PlaylistDownloaderService);

    const t = useTranslation();
    const [tabIndex, setTabIndex] = useState(0);

    const maps$ = useConstant(() => new BehaviorSubject<BsmLocalMap[]>(undefined));
    const playlists$ = useConstant(() => new BehaviorSubject<LocalBPListsDetails[]>(undefined));

    const mapsContextValue = useConstant(() => ({
        maps$,
        setMaps: maps$.next.bind(maps$),
        playlists$,
        setPlaylists: playlists$.next.bind(playlists$),
    }));

    const mapsRef = useRef<any>();
    const playlistsRef = useRef<LocalPlaylistsListRef>();

    const [mapFilter, setMapFilter] = useState<MapFilter>({});
    const [playlistFilter, setPlaylistFilter] = useState<LocalPlaylistFilter>({});

    const [search, setSearch] = useState("");
    const mapsLinkedState = useObservable(() => {
        if(!version) return of(FolderLinkState.Unlinked);
        return mapsManager.$mapsFolderLinkState(version);
    }, FolderLinkState.Unlinked, [version]);

    const playlistLinkedState = useObservable(() => {
        if(!version) return of(FolderLinkState.Unlinked);
        return playlistsManager.$playlistsFolderLinkState(version);
    }, FolderLinkState.Unlinked, [version]);

    const handleAddClick = () => {
        switch (tabIndex) {
            case 0: return mapsDownloader.openDownloadMapModal(version, maps$.value);
            case 1: return playlistsDownloader.openDownloadPlaylistModal(version, playlists$, maps$);
            default: return noop();
        }
    }

    const handleMapsLinkClick = () => {
        if(mapsLinkedState === FolderLinkState.Pending || mapsLinkedState === FolderLinkState.Processing){ return Promise.resolve(false); }

        if (mapsLinkedState === FolderLinkState.Unlinked) {
            return mapsManager.linkVersion(version);
        }

        return mapsManager.unlinkVersion(version);
    };

    const handlePlaylistLinkClick = () => {
        if(playlistLinkedState === FolderLinkState.Pending || playlistLinkedState === FolderLinkState.Processing){ return Promise.resolve(false); }

        if (playlistLinkedState === FolderLinkState.Unlinked) {
            return playlistsManager.linkVersion(version);
        }

        return playlistsManager.unlinkVersion(version);
    }

    const dropDownItems = ((): DropDownItem[] => {
        if (tabIndex === 0) {
            return [
                { icon: "export", text: "pages.version-viewer.maps.search-bar.dropdown.export-maps", onClick: () => mapsRef.current.exportMaps?.() },
                { icon: "trash", text: "pages.version-viewer.maps.search-bar.dropdown.delete-maps", onClick: () => mapsRef.current.deleteMaps?.() },
            ];
        }

        return [
            { icon: "add", text: t("playlist.create-a-playlist"), onClick: () => playlistsRef?.current?.createPlaylist?.() },
            { icon: "sync", text: t("playlist.synchronize-playlists"), onClick: () => playlistsRef?.current?.syncPlaylists?.() },
            { icon: "export", text: t("playlist.export-playlists"), onClick: () => playlistsRef?.current?.exportPlaylists?.() },
            { icon: "trash", text: t("playlist.delete-playlists"), onClick: () => playlistsRef?.current?.deletePlaylists?.() },
        ];
    })();

    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <nav className="w-full shrink-0 flex h-9 justify-center px-40 gap-2 text-main-color-1 dark:text-white">
                <BsmButton
                    className="flex items-center justify-center w-fit rounded-full px-2 py-1 font-bold whitespace-nowrap"
                    icon="add"
                    text="misc.add"
                    typeColor="primary"
                    withBar={false}
                    onClick={handleAddClick}
                />
                <div className="h-full rounded-full bg-light-main-color-2 dark:bg-main-color-2 grow p-[6px]">
                    <input
                        type="text"
                        className="h-full w-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2"
                        placeholder={tabIndex === 0 ? t("pages.version-viewer.maps.search-bar.search-placeholder") : t("playlist.search-playlist")}
                        value={search}
                        onChange={e => setSearch(() => e.target.value)}
                        tabIndex={-1}
                    />
                </div>
                <BsmDropdownButton className="h-full relative z-[1] flex justify-center" buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1 whitespace-nowrap" icon="filter" text="pages.version-viewer.maps.search-bar.filters-btn" textClassName="whitespace-nowrap" withBar={false}>
                    {(
                        tabIndex === 0 ? (
                            <FilterPanel className="absolute top-[calc(100%+3px)] origin-top w-[500px] h-fit p-2 rounded-md shadow-md shadow-black" filter={mapFilter} onChange={setMapFilter} />
                        ) : (
                            <LocalPlaylistFilterPanel className="absolute top-[calc(100%+3px)] origin-top w-[300px] h-fit p-2 rounded-md shadow-md shadow-black" filter={playlistFilter} onChange={setPlaylistFilter} />
                        )
                    )}
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
                            onClick: handlePlaylistLinkClick,
                        } : null,
                    },
                ]}
            >
                <InstalledMapsContext.Provider value={mapsContextValue}>
                    <LocalMapsListPanel className="w-full h-full shrink-0" isActive={isActive && tabIndex === 0} ref={mapsRef} version={version} filter={mapFilter} search={search} linkedState={mapsLinkedState} />
                    <LocalPlaylistsListPanel className="w-full h-full shrink-0" isActive={isActive && tabIndex === 1} ref={playlistsRef} version={version} linkedState={playlistLinkedState} filter={playlistFilter} search={search}/>
                </InstalledMapsContext.Provider>
            </BsContentTabPanel>
        </div>
    );
}
