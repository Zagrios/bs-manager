import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BbmCategories, BbmFullMod } from "shared/models/mods/mod.interface";
import { CSSProperties, MouseEvent, useMemo, useRef } from "react";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import useDoubleClick from "use-double-click";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import striptags from "striptags";
import { safeGt } from "shared/helpers/semver.helpers";

type Props = {
    className?: string;
    mod: BbmFullMod;
    installedVersion: string;
    isDependency?: boolean;
    isSelected?: boolean;
    onChange?: (val: boolean) => void;
    wantInfo?: boolean;
    onWantInfo?: (mod: BbmFullMod) => void;
    disabled?: boolean;
    onUninstall?: () => void;
};

export function ModItem({ className, mod, installedVersion, isDependency, isSelected, onChange, wantInfo, onWantInfo, disabled, onUninstall }: Props) {

    const themeColor = useThemeColor("second-color");
    const clickRef = useRef();

    const isChecked = useMemo(() => isDependency || isSelected || mod.mod.category === BbmCategories.Core, [isDependency, isSelected, mod.mod.category]);

    useDoubleClick({
        onSingleClick: e => handleWantInfo(e),
        onDoubleClick: e => handleOnChange(e),
        ref: clickRef,
        latency: 175,
    });

    useOnUpdate(() => {
        onChange(isChecked);
    }, [isChecked]);

    const wantInfoStyle: CSSProperties = wantInfo ? { borderColor: themeColor } : { borderColor: "transparent" };
    const isOutDated = installedVersion ? safeGt(mod.version.modVersion, installedVersion) : false;

    const handleWantInfo = (e: MouseEvent) => {
        e.preventDefault();
        onWantInfo(mod);
    };
    const handleOnChange = (e: MouseEvent) => {
        e.preventDefault();
        onChange(!isChecked);
    };

    const {fileSize} = mod.version;

    const verifyFileSize = fileSize !== undefined;

    const isMediumMod = verifyFileSize && fileSize/1024/1024 > 50;

    const isLargeMod = verifyFileSize && fileSize/1024/1024 > 100;

    const getFormattedSize = () : string => {
        if (!verifyFileSize)
            return `-`;
        if (fileSize/1024 > 1024)
            return `${Math.round(mod.version.fileSize/1024/1024)}MB`;
        return `${Math.round(mod.version.fileSize/1024)}KB`;
    };

    return (
        <li ref={clickRef} className={`${className} group/mod`}>
            <div className="h-full aspect-square flex items-center justify-center p-[7px] rounded-l-md bg-inherit ml-3 border-2 border-r-0 z-[1] group-hover/mod:brightness-90" style={wantInfoStyle}>
                <BsmCheckbox className="h-full aspect-square z-[1] relative bg-inherit" onChange={() => onChange(!isChecked)} disabled={mod.mod.category === BbmCategories.Core || isDependency || disabled} checked={isChecked} />
            </div>
            <span className="bg-inherit py-2 pl-3 font-bold text-sm whitespace-nowrap border-t-2 border-b-2 blur-none group-hover/mod:brightness-90" style={wantInfoStyle}>
                {mod.mod.name}
            </span>
            <span className={`min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 group-hover/mod:brightness-90 ${installedVersion && isOutDated && "text-red-400 line-through"} ${installedVersion && !isOutDated && "text-green-400"}`} style={wantInfoStyle}>
                {installedVersion || "-"}
            </span>
            <span className="min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 group-hover/mod:brightness-90" style={wantInfoStyle}>
                {mod.version.modVersion}
            </span>
            <span className={`min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 group-hover/mod:brightness-90 ${(isLargeMod ? "text-red-400 group/tooltip" : (isMediumMod ? "text-yellow-400 group/tooltip" : "") || "")}`} style={wantInfoStyle}>
                {getFormattedSize()}
                <span className={`opacity-0 group-hover/tooltip:opacity-100 text-center py-[5px] px-0 rounded-[6px] top-[7%] right-[105%] transition-opacity duration-500 absolute bg-black after:absolute after:top-[50%] after:left-full after:-mt-[5px] after:border-5 after:border-solid after:border-t-transparent after:border-r-transparent after:border-b-transparent after:border-l-black ${(isLargeMod ? `w-[160px] text-red-400` : (isMediumMod ? `w-[140px] text-yellow-400` : "") || "")}`}>
                    {(isLargeMod ? `This is a very large mod!` : (isMediumMod ? `This is a large mod!` : "") || "")}
                </span>
            </span>
            <span title={striptags(mod.mod?.description ?? "", { tagReplacementText: " " })} className="px-3 bg-inherit whitespace-nowrap text-ellipsis overflow-hidden py-2 text-sm border-t-2 border-b-2 group-hover/mod:brightness-90" style={wantInfoStyle}>
                {striptags(mod.mod?.summary ?? "", { tagReplacementText: " " })}
            </span>
            <div className="h-full bg-inherit flex items-center justify-center mr-3 rounded-r-md pr-2 border-t-2 border-b-2 border-r-2 group-hover/mod:brightness-90" style={wantInfoStyle}>
                {installedVersion && (
                    <BsmButton
                        className="z-[1] h-7 w-7 p-[5px] rounded-full group-hover/mod:brightness-90"
                        icon="trash"
                        disabled={disabled}
                        withBar={false}
                        onClick={e => {
                            e.stopPropagation();
                            onUninstall?.();
                        }}
                    />
                )}
            </div>
        </li>
    );
}
