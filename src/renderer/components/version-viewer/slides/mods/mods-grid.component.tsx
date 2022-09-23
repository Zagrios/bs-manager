import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { Mod } from "shared/models/mods/mod.interface"
import { ModItem } from "./mod-item.component"

type Props = {modsMap: Map<string, Mod[]>, installed: Map<string, Mod[]>}

export function ModsGrid({modsMap, installed}: Props) {

    const [filter, setFilter] = useState("");
    const [filterEnabled, setFilterEnabled] = useState(false);

    const inputRef = useRef();

    const installedMod = (key: string, mod: Mod): Mod => {
        if(!installed || !installed.get(key)){ return; }
        return installed.get(key).find(m => m.name === mod.name);
    }

    const handleInput = (val: string) => setFilter(val.toLowerCase());
    const handleToogleFilter = () => {
        setFilter("");
        setFilterEnabled(b => !b);
    }

  return modsMap && (
    <>
        <div className="grid gap-y-1 grid-cols-[40px_min-content_min-content_min-content_1fr]">
            <span className="sticky flex items-center justify-center top-0 bg-main-color-2 border-b-2 border-main-color-1">
                <div className="pl-4">
                    <BsmButton className="rounded-full h-6 p-[2px]" withBar={false} icon="search" onClick={handleToogleFilter}/>
                </div>
            </span>
            <div className="sticky top-0 flex items-center bg-main-color-2 border-main-color-1 border-b-2 h-8 w-52 px-1">
                {(filterEnabled ? (
                    <motion.input autoFocus ref={inputRef} className="bg-main-color-1 rounded-md h-6 px-2" initial={{width: 0}} animate={{width: "100%"}} onChange={e => handleInput(e.target.value)}/>   
                ):(
                    <span className="w-full text-center">Nom</span>
                ))}
            </div>
            
            <span className="sticky flex items-center justify-center text-sm top-0 bg-main-color-2 border-b-2 border-main-color-1 h-8 px-2">Installé</span>
            <span className="sticky flex items-center justify-center text-sm top-0 bg-main-color-2 border-b-2 border-main-color-1 h-8 px-2">Dernière</span>
            <span className="sticky flex items-center justify-center text-sm top-0 bg-main-color-2 border-b-2 border-main-color-1 h-8">Description</span>
            
            {
                Array.from(modsMap.keys()).map(key => (
                    <>
                        <span className="col-span-full py-1 font-bold pl-3" key={key}>{key}</span>
                        {modsMap.get(key).map(mod => mod.name.toLowerCase().includes(filter) && <ModItem key={mod.name} mod={mod} installed={installedMod(key, mod)}/>)}
                    </>
                ))
            }
        </div>
    </>
  )
}
