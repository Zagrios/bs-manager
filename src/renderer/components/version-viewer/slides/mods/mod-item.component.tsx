import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BbmCategories, BbmFullMod } from "shared/models/mods/mod.interface";
import { CSSProperties, MouseEvent, useMemo } from "react";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import striptags from "striptags";
import { safeGt } from "shared/helpers/semver.helpers";
import Tippy from "@tippyjs/react";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";

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

type FileSizeProps = {
    fileSize?: number;
    wantInfoStyle: CSSProperties;
};

function FileSizeText({ fileSize, wantInfoStyle }: Readonly<FileSizeProps>) {

    const { text: t } = useTranslationV2();

    const verifyFileSize = fileSize !== undefined;

    const isMediumMod = verifyFileSize && fileSize > 1024 * 1024 * 50; // 50MB

    const isLargeMod = verifyFileSize && fileSize > 1024 * 1024 * 100; // 100MB

    const getFormattedSize = () : string => {
        if (!verifyFileSize || fileSize === 0)
            return `-`;
        if (fileSize < 1024 * 1024)
            return `${(fileSize/1024).toFixed(2)}KB`;
        return `${(fileSize/1024/1024).toFixed(2)}MB`;
    };

    const getWarningText = () : string => {
        if (isLargeMod)
            return `pages.version-viewer.mods.mods-grid.mod-item.this-is-a-very-large-mod`;
        if (isMediumMod)
            return `pages.version-viewer.mods.mods-grid.mod-item.this-is-a-large-mod`;
        return "";
    };

    const getTheme = () : string => {
        if (isLargeMod)
            return 'red';
        if (isMediumMod)
            return 'yellow';
        return "";
    };

    const getTextColor = () : string => {
        if (isLargeMod)
            return "text-red-400";
        if (isMediumMod)
            return "text-yellow-400";
        return "";
    };

    return (

        <Tippy
            content={t(getWarningText())}
            placement="left"
            theme={getTheme()}
            disabled={!(isLargeMod || isMediumMod)}
            delay={[50, 0]} >
                <span className={`min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 group-hover:brightness-90 ${getTextColor()}`} style={wantInfoStyle}>
                    {getFormattedSize()}
                </span>
        </Tippy>
    );
}

export function ModItem({ className, mod, installedVersion, isDependency, isSelected, onChange, wantInfo, onWantInfo, disabled, onUninstall }: Props) {

    const themeColor = useThemeColor("second-color");

    const isChecked = useMemo(() => isDependency || isSelected || mod.mod.category === BbmCategories.Core, [isDependency, isSelected, mod.mod.category]);

    useOnUpdate(() => {
        onChange(isChecked);
    }, [isChecked]);

    const wantInfoStyle: CSSProperties = wantInfo ? { borderColor: themeColor } : { borderColor: "transparent" };
    const isOutDated = installedVersion ? safeGt(mod.version.modVersion, installedVersion) : false;

    const handleWantInfo = (e: MouseEvent) => {
        e.preventDefault();
        onWantInfo(mod);
    };

    return (
        <li className={`${className} group`} onClick={handleWantInfo}>
            <div className="h-full flex items-center justify-center p-1.5 px-4 rounded-l-md bg-inherit ml-3 border-2 border-r-0 z-[1] group-hover:brightness-90" style={wantInfoStyle}>
                <BsmCheckbox className="size-[18px] aspect-square z-[1] relative bg-inherit" onChange={() => onChange(!isChecked)} disabled={mod.mod.category === BbmCategories.Core || isDependency || disabled} checked={isChecked} />
            </div>
            <span className="bg-inherit py-2 pl-3 font-bold text-sm whitespace-nowrap border-t-2 border-b-2 blur-none group-hover:brightness-90 flex items-center" style={wantInfoStyle}>
                {mod.mod.name}
            </span>
            <span className={`min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 group-hover:brightness-90 ${installedVersion && isOutDated && "text-red-400 line-through"} ${installedVersion && !isOutDated && "text-green-400"}`} style={wantInfoStyle}>
                {installedVersion || "-"}
            </span>
            <span className="min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 group-hover:brightness-90" style={wantInfoStyle}>
                {mod.version.modVersion}
            </span>
            <FileSizeText fileSize={mod.version.fileSize} wantInfoStyle={wantInfoStyle} />
            <span title={striptags(mod.mod?.description ?? "", { tagReplacementText: " " })} className="px-3 bg-inherit whitespace-nowrap text-ellipsis overflow-hidden py-2 text-sm border-t-2 border-b-2 group-hover:brightness-90" style={wantInfoStyle}>
                {striptags(mod.mod?.summary ?? "", { tagReplacementText: " " })}
            </span>
            <div className="h-full bg-inherit flex items-center justify-center mr-3 rounded-r-md pr-2 border-t-2 border-b-2 border-r-2 group-hover:brightness-90" style={wantInfoStyle}>
                {installedVersion && (
                    <BsmButton
                        className="z-[1] h-7 w-7 p-[5px] rounded-full group-hover:brightness-90"
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
