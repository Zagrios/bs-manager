import { DetailedHTMLProps, useEffect, useRef, useState } from "react"
import { BSVersion } from "shared/bs-version.interface"
import { TabNavBar } from "../shared/tab-nav-bar.component"
import { LocalMapsListPanel } from "./local-maps-list-panel.component"
import { BsmDropdownButton, DropDownItem } from "../shared/bsm-dropdown-button.component"
import { FilterPanel } from "./filter-panel.component"
import { MapFilter } from "shared/models/maps/beat-saver.model"
import { BsmButton } from "../shared/bsm-button.component"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook"
import { MapsManagerService } from "renderer/services/maps-manager.service"
import { motion, Variants } from "framer-motion";
import ReactTooltip from 'react-tooltip';
import { MapsDownloaderService } from "renderer/services/maps-downloader.service"
import { BsmImage } from "../shared/bsm-image.component"
import wipGif from "../../../../assets/images/gifs/wip.gif"
import { OsDiagnosticService } from "renderer/services/os-diagnostic.service"

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
    const color = useThemeColor("first-color");
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
        mapsDownloader.openDownloadMapModal(version);
    }

    const renderTab = (props: DetailedHTMLProps<React.HTMLAttributes<HTMLLIElement>, HTMLLIElement>, text: string, index: number): JSX.Element => {

        const linkedColor = mapsLinked ? color : "red";
        const addMapColor = color;

        const onClickLink = (index: number) => {
            if(index === 0){ handleMapsLinkClick(); }
        }

        const onClickAdd = (index: number) => {
            if(index === 0){ handleMapsAddClick(); }
        }

        const variants: Variants = { hover: {rotate: 22.5}, tap: {rotate: 45} };

        return (
            <li className="relative text-center text-lg font-bold hover:backdrop-brightness-75 flex justify-center items-center content-center" onClick={props.onClick}>
                <span>{text}</span>
                {index === 0 &&(
                    <div className="h-full flex absolute right-0 top-0 gap-1.5 items-center pr-2">
                        
                        <motion.div variants={variants} whileHover="hover" whileTap="tap" initial={{rotate: 0}} className="block p-0.5 h-[calc(100%-5px)] aspect-square blur-0 hover:brightness-75" data-tip data-for="add-tooltip"> 
                            <span className="absolute top-0 left-0 h-full w-full rounded-full opacity-20" style={{backgroundColor: addMapColor}}/>
                            <BsmButton className="p-0.5 absolute top-0 left-0 h-full w-full !bg-transparent" iconClassName="" icon="add" withBar={false} style={{color: addMapColor}} onClick={e => {e.stopPropagation(); onClickAdd(index)}}/>
                        </motion.div>
                        <ReactTooltip id="add-tooltip" effect="solid" padding="5px">
                            <span className="whitespace-nowrap">Ajouté des maps</span> {/* TODO TRANSLATE */}
                        </ReactTooltip>
                        {(!!version && osDiagnostic.isOnline) && (
                            <motion.div variants={variants} whileHover="hover" whileTap="tap" initial={{rotate: 0}} className="block p-0.5 h-[calc(100%-5px)] aspect-square blur-0 hover:brightness-75" title={mapsLinked ? "Délier les maps" : "Lier les maps"}> 
                                <span className="absolute top-0 left-0 h-full w-full rounded-full opacity-20" style={{backgroundColor: linkedColor}}/>
                                <BsmButton className="p-1 absolute top-0 left-0 h-full w-full !bg-transparent -rotate-45" iconClassName="" icon={mapsLinked ? "link" : "unlink"} withBar={false} style={{color: linkedColor}} onClick={e => {e.stopPropagation(); onClickLink(index)}}/>
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
            {icon:"export", text: "Exporter les maps", onClick: () => mapsRef.current.exportMaps?.()},
            {icon: "trash", text: "Supprimer les maps", onClick: () => mapsRef.current.deleteMaps?.()}
        ]

    })()

    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            <nav className="w-full shrink-0 flex h-[35px] justify-center px-40 gap-2 mb-3">
                <div className="h-full rounded-full bg-main-color-2 grow p-[6px]">
                    <input type="text" className="h-full w-full bg-main-color-1 rounded-full px-2" placeholder="Rechercher" value={tabIndex === 0 ? mapSearch : playlistSearch} onChange={e => handleSearch(e.target.value)}/>
                </div>
                <BsmDropdownButton className="h-full relative z-[1] flex justify-center" buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1" icon="search" text="Filtres" withBar={false}>
                    <FilterPanel className="absolute top-[calc(100%+3px)] bg-main-color-3 origin-top w-[500px] h-fit p-2 rounded-md shadow-md shadow-black" filter={mapFilter} onChange={setMapFilter}/>
                </BsmDropdownButton>
                <BsmDropdownButton className="h-full flex aspect-square relative rounded-full z-[1] bg-main-color-3" buttonClassName="rounded-full h-full w-full p-[6px]" icon="three-dots" withBar={false} items={dropDownItems} menuTranslationY="6px" align="center"/>
            </nav>
            <div className="w-full h-full flex flex-col bg-main-color-2 rounded-md shadow-black shadow-md overflow-hidden">
                <TabNavBar className="!rounded-none shadow-sm" tabsText={["misc.maps", "Playlists"]} onTabChange={setTabIndex} renderTab={renderTab}/>
                <div className="w-full grow min-h-0 flex flex-row items-center transition-transform duration-300" style={{transform: `translate(${-(tabIndex * 100)}%, 0)`}}>
                    <LocalMapsListPanel ref={mapsRef} className="w-full h-full shrink-0 flex flex-col" version={version} filter={mapFilter} search={mapSearch}/>
                    <div className="w-full h-full shrink-0 flex flex-col justify-center items-center content-center gap-2 overflow-hidden">
                        <BsmImage className="rounded-md" image={wipGif}/>
                        <span>Work in progress</span>
                    </div>
                </div>
            </div> 
        </div>
    )
}
