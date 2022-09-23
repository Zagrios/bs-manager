import { useEffect, useState } from "react";
import { BsModsManagerService } from "renderer/services/bs-mods-manager.service";
import { BSVersion } from "shared/bs-version.interface";
import VisibilitySensor  from 'react-visibility-sensor';
import { Mod } from "shared/models/mods/mod.interface";
import { ModItem } from "./mod-item.component";
import { ModsGrid } from "./mods-grid.component";

export function ModsSlide({version}: {version: BSVersion}) {

    const modsManager = BsModsManagerService.getInstance();

    const [isVisible, setIsVisible] = useState(false);
    const [modsAvailable, setModsAvailable] = useState(null as Map<string, Mod[]>);
    const [modsInstalled, setModsInstalled] = useState(null as Map<string, Mod[]>);

    const modsToCategoryMap = (mods: Mod[]): Map<string, Mod[]> => {
        if(!mods){ return new Map<string, Mod[]>(); }
        const map = new Map<string, Mod[]>();
        mods.forEach(mod => map.set(mod.category, [...map.get(mod.category) ?? [], mod]));
        return map;
    }

    useEffect(() => {
        if(!isVisible){ return; }

        if(!modsAvailable){
            console.log("OUI");
            modsManager.getAvailableMods(version).then(mods => setModsAvailable(modsToCategoryMap(mods)));
            modsManager.getInstalledMods(version).then(mods => setModsInstalled(modsToCategoryMap(mods)));
        }
    }, [isVisible]);
    

    return (
        <VisibilitySensor onChange={setIsVisible}>
            <div className='shrink-0 w-full h-full px-8 pb-8 flex justify-center'>
                <div className='flex flex-col grow-0 bg-light-main-color-2 dark:bg-main-color-2 h-full w-full rounded-md shadow-black shadow-center overflow-hidden'>
                    <div className="overflow-scroll w-full shrink min-h-0 scrollbar-thin scrollbar-thumb-neutral-900 scrollbar-thumb-rounded-full">
                        <ModsGrid modsMap={modsAvailable} installed={modsInstalled}/>
                    </div>
                    <div className=" h-10 shrink-0">

                    </div>
                </div>
            </div>
        </VisibilitySensor>
        
    )
}
