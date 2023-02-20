import { DetailedHTMLProps, useEffect, useRef, useState } from "react"
import { BSVersion } from "shared/bs-version.interface"
import { TabNavBar } from "../shared/tab-nav-bar.component"
import { LocalMapsListPanel } from "./local-maps-list-panel.component"
import { BsmDropdownButton, DropDownItem } from "../shared/bsm-dropdown-button.component"
import { FilterPanel } from "./filter-panel.component"
import { MapFilter } from "shared/models/maps/beat-saver.model"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook"
import { MapsManagerService } from "renderer/services/maps-manager.service"
import { motion, Variants } from "framer-motion";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service"
import { BsmImage } from "../shared/bsm-image.component"
import wipGif from "../../../../assets/images/gifs/wip.gif"
import { OsDiagnosticService } from "renderer/services/os-diagnostic.service"
import { useObservable } from "renderer/hooks/use-observable.hook"
import { BsmIcon } from "../svgs/bsm-icon.component"
import { useTranslation } from "renderer/hooks/use-translation.hook"

type Props = {
    version?: BSVersion
}

export function MapsPlaylistsPanel({version}: Props) {

    const mapsService = MapsManagerService.getInstance();
    const mapsDownloader = MapsDownloaderService.getInstance();
    const osDiagnostic = OsDiagnosticService.getInstance();
    
    const [tabIndex, setTabIndex] = useState(0);
    const [mapFilter, setMapFilter] = useState<MapFilter>({});
    const [mapSearch, setMapSearch] = useState("");
    const [playlistSearch, setPlaylistSearch] = useState("");
    const [mapsLinked, setMapsLinked] = useState(false);
    const isOnline = useObservable(osDiagnostic.isOnline$);
    const color = useThemeColor("first-color");
    const t = useTranslation();
    const mapsRef = useRef<any>();

    useEffect(() => {
        loadMapIsLinked();
    }, [version]);

    const loadMapIsLinked = () => {
        mapsService.versionHaveMapsLinked(version).then(setMapsLinked);
    }

    const handleSearch = (value: string) => {
        if(tabIndex === 0){
            return setMapSearch(() => value);
        }
        return setPlaylistSearch(() => value);
    }

    const handleMapsLinkClick = () => {
        if(!mapsLinked){
            return mapsService.linkVersion(version).then(loadMapIsLinked);
        }
        return mapsService.unlinkVersion(version).then(loadMapIsLinked);
    }

    const handleMapsAddClick = () => {
        mapsDownloader.openDownloadMapModal(version, mapsRef.current.getMaps?.());
    }

    const renderTab = (props: DetailedHTMLProps<React.HTMLAttributes<HTMLLIElement>, HTMLLIElement>, text: string, index: number): JSX.Element => {

        const linkedColor = mapsLinked ? color : "red";

        const onClickLink = (index: number) => {
            if(index === 0){ handleMapsLinkClick(); }
        }

        const onClickAdd = (index: number) => {
            if(index === 0){ handleMapsAddClick(); }
        }

        const variants: Variants = { hover: {rotate: 22.5}, tap: {rotate: 45} };

        return (
            <li className="relative text-center text-lg font-bold hover:backdrop-brightness-75 flex justify-center items-center content-center" onClick={props.onClick}>
                <span className="text-main-color-1 dark:text-gray-200">{text}</span>
                {index === 0 &&(
                    <div className="h-full flex absolute right-0 top-0 gap-1.5 items-center pr-2">
                        {isOnline && (
                            <motion.div whileHover="hover" whileTap="tap" className="relative h-[calc(100%-5px)] flex flex-row justify-center items-center shrink-0 rounded-full overflow-hidden pr-2" style={{color}} onClick={e => {e.stopPropagation(); onClickAdd(index)}}>
                                <span className="absolute top-0 left-0 h-full w-full brightness-50 opacity-75 dark:opacity-20 dark:filter-none" style={{backgroundColor: "currentcolor"}}/>
                                <motion.div className="h-full p-0.5" variants={variants}>
                                    <BsmIcon className="block h-full aspect-square brightness-150" icon="add"/>
                                </motion.div>
                                <span className="text-sm brightness-150">{t("pages.version-viewer.maps.tabs.maps.actions.add-maps.text")}</span>
                            </motion.div>
                        )}
                        {(!!version) && (
                            <motion.div variants={variants} whileHover="hover" whileTap="tap" initial={{rotate: 0}} className="block p-0.5 h-[calc(100%-5px)] aspect-square blur-0 hover:brightness-75" title={t(mapsLinked ? "pages.version-viewer.maps.tabs.maps.actions.link-maps.tooltips.unlink" : "pages.version-viewer.maps.tabs.maps.actions.link-maps.tooltips.link")} onClick={e => {e.stopPropagation(); onClickLink(index)}}> 
                                <span className="absolute top-0 left-0 h-full w-full rounded-full brightness-50 opacity-75 dark:opacity-20 dark:filter-none" style={{backgroundColor: linkedColor}}/>
                                <BsmIcon className="p-1 absolute top-0 left-0 h-full w-full !bg-transparent -rotate-45 brightness-150" icon={mapsLinked ? "link" : "unlink"} style={{color: linkedColor}} />
                            </motion.div>
                        )}
                    </div>
                )}
                
            </li>
        )
    }

    const dropDownItems = ((): DropDownItem[] => {
        if(tabIndex === 1){
            return  [

            ]
        }
        return [
            {icon:"export", text: "pages.version-viewer.maps.search-bar.dropdown.export-maps", onClick: () => mapsRef.current.exportMaps?.()},
            {icon: "trash", text: "pages.version-viewer.maps.search-bar.dropdown.delete-maps", onClick: () => mapsRef.current.deleteMaps?.()}
        ]

    })()

    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            <nav className="w-full shrink-0 flex h-9 justify-center px-40 gap-2 mb-3 text-main-color-1 dark:text-white">
                <div className="h-full rounded-full bg-light-main-color-2 dark:bg-main-color-2 grow p-[6px]">
                    <input type="text" className="h-full w-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2" placeholder={t("pages.version-viewer.maps.search-bar.search-placeholder")} value={tabIndex === 0 ? mapSearch : playlistSearch} onChange={e => handleSearch(e.target.value)} tabIndex={-1}/>
                </div>
                <BsmDropdownButton className="h-full relative z-[1] flex justify-center" buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1" icon="filter" text="pages.version-viewer.maps.search-bar.filters-btn" withBar={false}>
                    <FilterPanel className="absolute top-[calc(100%+3px)] origin-top w-[500px] h-fit p-2 rounded-md shadow-md shadow-black" filter={mapFilter} onChange={setMapFilter}/>
                </BsmDropdownButton>
                <BsmDropdownButton className="h-full flex aspect-square relative rounded-full z-[1] bg-light-main-color-1 dark:bg-main-color-3" buttonClassName="rounded-full h-full w-full p-[6px]" icon="three-dots" withBar={false} items={dropDownItems} menuTranslationY="6px" align="center"/>
            </nav>
            <div className="w-full h-full flex flex-col bg-light-main-color-3 dark:bg-main-color-2 rounded-md shadow-black shadow-md overflow-hidden">
                <TabNavBar className="!rounded-none shadow-sm" tabIndex={tabIndex} tabsText={["misc.maps", "misc.playlists"]} onTabChange={setTabIndex} renderTab={renderTab}/>
                <div className="w-full grow min-h-0 flex flex-row items-center transition-transform duration-300" style={{transform: `translate(${-(tabIndex * 100)}%, 0)`}}>
                    <LocalMapsListPanel ref={mapsRef} className="w-full h-full shrink-0 flex flex-col" version={version} filter={mapFilter} search={mapSearch}/>
                    <div className="w-full h-full shrink-0 flex flex-col justify-center items-center content-center gap-2 overflow-hidden">
                        <BsmImage className="rounded-md" image={wipGif}/>
                        <span>Coming soon</span>
                    </div>
                </div>
            </div> 
        </div>
    )
}
