import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { Mod } from "shared/models/mods/mod.interface";
import { CSSProperties, useRef, useState } from "react"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { BsModsManagerService } from "renderer/services/bs-mods-manager.service";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { PageStateService } from "renderer/services/page-state.service";
import useDoubleClick from 'use-double-click';

type Props = {mod: Mod, installedVersion: string, isDependency?: boolean, isSelected?: boolean, onChange?: (val: boolean) => void, wantInfo?: boolean, onWantInfo?: (mod: Mod) => void}

export function ModItem({mod, installedVersion, isDependency, isSelected, onChange, wantInfo, onWantInfo}: Props) {

    const modsManager = BsModsManagerService.getInstance();
    const pageState = PageStateService.getInstance();

    const themeColor = useThemeColor("second-color");
    const uninstalling = useObservable(modsManager.isUninstalling$);
    const clickRef = useRef();

    useDoubleClick({
        onSingleClick: e => handleWantInfo(e),
        onDoubleClick: e => handleOnChange(e),
        ref: clickRef,
        latency: 200
    })

    const wantInfoStyle: CSSProperties = wantInfo ? {borderColor: themeColor}  : {borderColor: "transparent"};
    const isOutDated =  installedVersion < mod.version;

    const uninstall = () => {
        modsManager.uninstallMod(mod, pageState.getState());
    }

    const handleWantInfo = (e: React.MouseEvent<Element, MouseEvent>) => { e.preventDefault(); onWantInfo(mod); }
    const handleOnChange = (e: React.MouseEvent<Element, MouseEvent>) => { e.preventDefault(); onChange(!isChecked); }

    const isChecked = isDependency || isSelected ||  mod.required;

    return (
        <div ref={clickRef} className="contents bg-light-main-color-3 dark:bg-main-color-1 text-main-color-1 dark:text-light-main-color-1">
            <div className="h-full aspect-square flex items-center justify-center p-[7px] rounded-l-md bg-inherit ml-3 border-2 border-r-0" style={wantInfoStyle}>
                <BsmCheckbox className="h-full aspect-square z-[1] relative bg-inherit" onChange={onChange} disabled={mod.required || isDependency} checked={isChecked}/>
            </div>
            <span className="bg-inherit py-2 pl-3 font-bold text-sm whitespace-nowrap border-t-2 border-b-2 blur-none" style={wantInfoStyle}>{mod.name}</span>
            <span className={`min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 ${(installedVersion && isOutDated) && "text-red-400 line-through"} ${installedVersion && !isOutDated && "text-green-400"}`} style={wantInfoStyle}>{installedVersion || "-"}</span>
            <span className="min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2" style={wantInfoStyle}>{mod.version}</span>
            <span title={mod.description} className="px-3 bg-inherit whitespace-nowrap text-ellipsis overflow-hidden py-2 text-sm border-t-2 border-b-2" style={wantInfoStyle}>{mod.description}</span>
            <div className="h-full bg-inherit flex items-center justify-center mr-3 rounded-r-md pr-2 border-t-2 border-b-2 border-r-2" style={wantInfoStyle}>
                {installedVersion && <BsmButton className="z-[1] h-7 w-7 p-[5px] rounded-full" icon="trash" disabled={uninstalling} withBar={false} onClick={e => {e.stopPropagation(); uninstall()}}/>}
            </div>
        </div>
    )
}
