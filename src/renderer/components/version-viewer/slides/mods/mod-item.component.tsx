import { Mod } from "shared/models/mods/mod.interface"

type Props = {mod: Mod, installed: Mod}

export function ModItem({mod, installed}: Props) {
    return (
        <>
            <div className="h-full aspect-square flex items-center justify-center p-2 rounded-l-md bg-main-color-1 ml-3">
                <span className="w-full h-full border-white border-2 rounded-md"></span>
            </div>
            <span className="bg-main-color-1 py-2 pl-3 font-bold text-sm whitespace-nowrap">{mod.name}</span>
            <span className="min-w-0 text-center bg-main-color-1 py-2 px-1 text-sm">{installed?.version || "-"}</span>
            <span className="min-w-0 text-center bg-main-color-1 py-2 px-1 text-sm">{mod.version}</span>
            <span title={mod.description} className="px-3 bg-main-color-1 whitespace-nowrap text-ellipsis overflow-hidden py-2 text-sm rounded-r-md mr-3">{mod.description}</span>
        </>
    )
}
