import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { Mod } from "shared/models/mods/mod.interface";
import { CSSProperties } from "react"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";

type Props = {mod: Mod, installedVersion: string, isDependency?: boolean, isSelected?: boolean, onChange?: (val: boolean) => void, wantInfo?: boolean}

export function ModItem({mod, installedVersion, isDependency, isSelected, onChange, wantInfo}: Props) {

    const themeColor = useThemeColor("second-color");

    const wantInfoStyle: CSSProperties = wantInfo ? {borderColor: themeColor}  : {borderColor: "transparent"};
    const isOutDated = (() => {
        return installedVersion < mod.version;
    })()

    return (
        <>
            <div className="h-full aspect-square flex items-center justify-center p-[7px] rounded-l-md bg-main-color-1 ml-3 border-t-2 border-b-2 border-l-2" style={wantInfoStyle}>
                <BsmCheckbox className="h-full aspect-square z-[1] relative bg-main-color-1" onChange={onChange} disabled={mod.required || isDependency} checked={isDependency || isSelected ||  mod.required}/>
            </div>
            <span className="bg-main-color-1 py-2 pl-3 font-bold text-sm whitespace-nowrap border-t-2 border-b-2"  style={wantInfoStyle}>{mod.name}</span>
            <span className={`min-w-0 text-center bg-main-color-1 py-2 px-1 text-sm border-t-2 border-b-2 ${(installedVersion && isOutDated) && "text-red-400 line-through"} ${installedVersion && !isOutDated && "text-green-400"}`} style={wantInfoStyle}>{installedVersion || "-"}</span>
            <span className="min-w-0 text-center bg-main-color-1 py-2 px-1 text-sm border-t-2 border-b-2" style={wantInfoStyle}>{mod.version}</span>
            <span title={mod.description} className="px-3 bg-main-color-1 whitespace-nowrap text-ellipsis overflow-hidden py-2 text-sm border-t-2 border-b-2" style={wantInfoStyle}>{mod.description}</span>
            <div className="h-full bg-main-color-1 flex items-center justify-center mr-3 rounded-r-md pr-2 border-t-2 border-b-2 border-r-2" style={wantInfoStyle}>
                {(installedVersion && !mod.required) && <BsmButton className="h-7 w-7 p-[5px] rounded-full" icon="trash" withBar={false}/>}
            </div>
        </>
    )
}
