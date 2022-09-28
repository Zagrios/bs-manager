import { motion } from "framer-motion";
import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { Mod } from "shared/models/mods/mod.interface"
import { ModItem } from "./mod-item.component"

type Props = {modsMap: Map<string, Mod[]>, installed: Map<string, Mod[]>, modsSelected: Mod[], onModChange: (selected: boolean, mod: Mod) => void, moreInfoMod?: Mod, onWantInfos: (mod: Mod) => void}

export function ModsGrid({modsMap, installed, modsSelected, onModChange, moreInfoMod, onWantInfos}: Props) {

    const [filter, setFilter] = useState("");
    const [filterEnabled, setFilterEnabled] = useState(false);

    const installedModVersion = (key: string, mod: Mod): string => {
        if(!installed || !installed.get(key)){ return undefined; }
        const installedMod = installed.get(key).find(m => m.name === mod.name);
        if(!installedMod){ return undefined }
        return installedMod.version
    }

    const isDependency = (mod: Mod): boolean => {
        return modsSelected.some(m => {
            const deps = m.dependencies.map(dep => Array.from(modsMap.values()).flat().find(m => dep.name === m.name));
            if(deps.some(depMod => depMod.name === mod.name)){ return true; }
            return deps.some(depMod => depMod.dependencies.some(depModDep => depModDep.name === mod.name));
        });
    }

    const isSelected = (mod: Mod): boolean => modsSelected.some(m => m.name === mod.name);

    const handleInput = (val: string) => setFilter(val.toLowerCase());

    const handleToogleFilter = () => {
        setFilter("");
        setFilterEnabled(b => !b);
    }

  return modsMap && (
        <div className="grid gap-y-1 grid-cols-[40px_min-content_min-content_min-content_1fr_min-content]"> 
            <span className="absolute z-10 top-0 w-full h-8 bg-main-color-2"/>
            <span className="z-10 sticky flex items-center justify-center top-0 bg-main-color-2 border-b-2 border-main-color-1">
                <div className="pl-4">
                    <BsmButton className="rounded-full h-6 p-[2px]" withBar={false} icon="search" onClick={handleToogleFilter}/>
                </div>
            </span>
            <span className="z-10 sticky top-0 flex items-center bg-main-color-2 border-main-color-1 border-b-2 h-8 px-1">
                {(filterEnabled ? (
                    <motion.input autoFocus className="bg-main-color-1 rounded-md h-6 px-2" initial={{width: 0}} animate={{width: "250px"}} transition={{ease:"easeInOut", duration:.15}} onChange={e => handleInput(e.target.value)}/>   
                ):(
                    <span className="w-full text-center">Nom</span>
                ))}
            </span>
            
            <span className="z-10 sticky flex items-center justify-center top-0 bg-main-color-2 border-b-2 border-main-color-1 h-8 px-2">Installé</span>
            <span className="z-10 sticky flex items-center justify-center top-0 bg-main-color-2 border-b-2 border-main-color-1 h-8 px-2">Récent</span>
            <span className="z-10 sticky flex items-center justify-center top-0 bg-main-color-2 border-b-2 border-main-color-1 h-8">Description</span>
            <span className="z-10 sticky top-0 bg-main-color-2 border-b-2 border-main-color-1 h-8"></span>
            
            {
                Array.from(modsMap.keys()).map(key => modsMap.get(key).some(mod => mod.name.toLowerCase().includes(filter)) && (
                    <div key={key} className="contents">
                        <span className="col-span-full py-1 font-bold pl-3">{key}</span>
                        {modsMap.get(key).map(mod => mod.name.toLowerCase().includes(filter) && (
                            <div className="contents cursor-pointer" onClick={() => onWantInfos(mod)} key={mod.name}>
                                <ModItem mod={mod} installedVersion={installedModVersion(key, mod)} isDependency={isDependency(mod)} isSelected={isSelected(mod)} onChange={(val) => onModChange(val, mod)} wantInfo={mod.name === moreInfoMod?.name}/>
                            </div>
                            
                        ))}
                    </div>
                ))
            }
        </div>
  )
}
