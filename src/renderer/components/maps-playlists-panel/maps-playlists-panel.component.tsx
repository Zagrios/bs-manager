import { createContext, useRef, useState } from "react";
import { BSVersion } from "shared/bs-version.interface";
import { LocalMapsListPanel, LocalMapsListPanelRef } from "./maps/local-maps-list-panel.component";
import { BsmDropdownButton, DropDownItem } from "../shared/bsm-dropdown-button.component";
import { FilterPanel } from "./maps/filter-panel.component";
import { MapFilter } from "shared/models/maps/beat-saver.model";
import { MapsManagerService } from "renderer/services/maps-manager.service";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import { useService } from "renderer/hooks/use-service.hook";
import { BsContentTabPanel } from "../shared/bs-content-tab-panel/bs-content-tab-panel.component";
import { MapIcon } from "../svgs/icons/map-icon.component";
import { PlaylistIcon } from "../svgs/icons/playlist-icon.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { BehaviorSubject, lastValueFrom, of } from "rxjs";
import { LocalPlaylistsListPanel, LocalPlaylistsListRef } from "./playlists/local-playlists-list-panel.component";
import { PlaylistsManagerService } from "renderer/services/playlists-manager.service";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { PlaylistDownloaderService } from "renderer/services/playlist-downloader.service";
import { LocalPlaylistFilter, LocalPlaylistFilterPanel } from "./playlists/local-playlist-filter-panel.component";
import { noop } from "shared/helpers/function.helpers";
import { Dropzone } from "../shared/dropzone.component";
import { logRenderError } from "renderer";

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

    const [mapsDropZoneOpen, setMapsDropZoneOpen] = useState(false);
    const [playlistsDropZoneOpen, setPlaylistsDropZoneOpen] = useState(false);

    const maps$ = useConstant(() => new BehaviorSubject<BsmLocalMap[]>(undefined));
    const playlists$ = useConstant(() => new BehaviorSubject<LocalBPListsDetails[]>(undefined));

    const mapsContextValue = useConstant(() => ({
        maps$,
        setMaps: maps$.next.bind(maps$),
        playlists$,
        setPlaylists: playlists$.next.bind(playlists$),
    }));

    const mapsRef = useRef<LocalMapsListPanelRef>();
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

    const handleBrowse = () => {
        switch (tabIndex) {
            case 0:
                mapsDownloader.openDownloadMapModal(version, maps$.value);
                return;
            case 1:
                playlistsDownloader.openDownloadPlaylistModal(version, playlists$, maps$);
                return;
            default:
                return noop();
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

    const importMaps = async (paths: string[]) => {
        setMapsDropZoneOpen(() => false);
        return lastValueFrom(mapsManager.importMaps(paths, version)).catch(logRenderError);
    }

    const importPlaylists = async (paths: string[]) => {
        setPlaylistsDropZoneOpen(() => false);
        return lastValueFrom(playlistsManager.importPlaylists({ version, paths })).catch(logRenderError);
    }

    const addDropDownItems = ((): DropDownItem[] => {
        if(tabIndex === 0){
            return [
                { icon: "browse", text: "pages.version-viewer.maps.tabs.maps.actions.drop-down.browse-maps", onClick: handleBrowse },
                { icon: "download", text: "pages.version-viewer.maps.tabs.maps.actions.drop-down.import-maps", onClick: () => setMapsDropZoneOpen(true) }
            ];
        }

        return [
            { icon: "browse", text: "pages.version-viewer.maps.tabs.playlists.drop-down.browse-playlists", onClick: handleBrowse },
            { icon: "add-file", text: "pages.version-viewer.maps.tabs.playlists.drop-down.create-a-playlist", onClick: () => playlistsRef?.current?.createPlaylist?.()  },
            { icon: "download", text: "pages.version-viewer.maps.tabs.playlists.drop-down.import-playlists", onClick: () => setPlaylistsDropZoneOpen(true) }
        ];
    })();

    const dropDownItems = ((): DropDownItem[] => {
        if (tabIndex === 0) {
            return [
                { icon: "export", text: "pages.version-viewer.maps.search-bar.dropdown.export-maps", onClick: () => mapsRef.current.exportMaps?.() },
                { icon: "trash", text: "pages.version-viewer.maps.search-bar.dropdown.delete-maps", onClick: () => mapsRef.current.deleteMaps?.() },
                { icon: "clean", text: "pages.version-viewer.maps.search-bar.dropdown.delete-duplicate-maps", onClick: () => mapsRef.current.removeDuplicates?.() },
            ];
        }

        return [
            { icon: "sync", text: t("playlist.synchronize-playlists"), onClick: () => playlistsRef?.current?.syncPlaylists?.() },
            { icon: "export", text: t("playlist.export-playlists"), onClick: () => playlistsRef?.current?.exportPlaylists?.() },
            { icon: "trash", text: t("playlist.delete-playlists"), onClick: () => playlistsRef?.current?.deletePlaylists?.() },
        ];
    })();

    return (
        <>
            <nav className="w-full shrink-0 flex h-9 justify-center px-40 gap-2 text-main-color-1 dark:text-white mb-4">
                <BsmDropdownButton
                    classNames={{
                        mainContainer: "h-full relative z-[1] flex justify-center w-fit",
                        button: "flex items-center justify-center h-full rounded-full px-2 py-1 font-bold whitespace-nowrap shadow-none",
                        itemsContainer: "bg-theme-3",
                    }}
                    textClassName="whitespace-nowrap"
                    icon="add"
                    buttonColor="primary"
                    text="misc.add"
                    align="center"
                    menuTranslationY="6px"
                    withBar={false}
                    items={addDropDownItems}
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

                    <Dropzone
                        className="w-full h-full shrink-0"
                        onFiles={importMaps}
                        text={t("pages.version-viewer.maps.tabs.maps.drop-zone.text")}
                        subtext={t("pages.version-viewer.maps.tabs.maps.drop-zone.subtext")}
                        open={mapsDropZoneOpen}
                        onClose={mapsDropZoneOpen ? () => setMapsDropZoneOpen(() => false) : undefined}
                        filters={[{ name: ".zip", extensions: ["zip"] }]}
                        dialogOptions={{ dialog: {
                            properties: ["openFile", "multiSelections"],
                        }}}
                    >
                        <LocalMapsListPanel className="w-full h-full shrink-0" isActive={isActive && tabIndex === 0} ref={mapsRef} version={version} filter={mapFilter} search={search} linkedState={mapsLinkedState} />
                    </Dropzone>

                    <Dropzone
                        className="w-full h-full shrink-0"
                        onFiles={importPlaylists}
                        text={t("pages.version-viewer.maps.tabs.playlists.drop-zone.text")}
                        subtext={t("pages.version-viewer.maps.tabs.playlists.drop-zone.subtext")}
                        open={playlistsDropZoneOpen}
                        onClose={playlistsDropZoneOpen ? () => setPlaylistsDropZoneOpen(() => false) : undefined}
                        filters={[{ name: ".bplist, .json", extensions: ["bplist", "json"] }]}
                        dialogOptions={{ dialog: {
                            properties: ["openFile", "multiSelections"],
                        }}}
                    >
                        <LocalPlaylistsListPanel className="w-full h-full shrink-0" isActive={isActive && tabIndex === 1} ref={playlistsRef} version={version} linkedState={playlistLinkedState} filter={playlistFilter} search={search}/>
                    </Dropzone>

                </InstalledMapsContext.Provider>
            </BsContentTabPanel>
            </>
    );
}
