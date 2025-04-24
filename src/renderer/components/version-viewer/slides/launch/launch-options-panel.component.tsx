import Tippy from "@tippyjs/react";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { PinIcon } from "renderer/components/svgs/icons/pin-icon.component";
import { UnpinIcon } from "renderer/components/svgs/icons/unpin-icon.component";
import { SvgIcon } from "renderer/components/svgs/svg-icon.type";
import { cn } from "renderer/helpers/css-class.helpers";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { AddIcon } from "renderer/components/svgs/icons/add-icon.component";
import { EditIcon } from "renderer/components/svgs/icons/edit-icon.component";
import { TrashIcon } from "renderer/components/svgs/icons/trash-icon.component";

type Props = {
    readonly className?: string;
    readonly open: boolean;
    readonly launchArgs?: string;
    readonly launchMods?: LaunchModItemProps[];
    readonly onLaunchArgsChange?: (args: string) => void;
    readonly onAddLaunchMod?: (command?: string) => void;
};

export function LaunchOptionsPanel({ className, open, launchArgs, launchMods, onLaunchArgsChange, onAddLaunchMod }: Props) {

    const color = useThemeColor("first-color");
    const { text: t } = useTranslationV2();

    return (
        <div className={cn("grid grid-rows-[0fr] transition-[grid-template-rows] bg-theme-2 rounded-md shadow-md shadow-black overflow-hidden", open && "!grid-rows-[1fr]", className)}>
            <div className="flex flex-col overflow-y-scroll scrollbar-default">
                <div className="p-3.5">
                    <div className="w-full relative flex justify-center items-center mb-2">
                        <input className="h-10 w-full rounded-md bg-theme-1 text-center" type="text" placeholder={t("pages.version-viewer.launch-mods.advanced-launch.placeholder")} value={launchArgs} onChange={e => onLaunchArgsChange(e.target.value)}/>
                        <Tippy theme="default" placement="top" content={t("pages.version-viewer.launch-mods.advanced-launch.create-launch-option")}>
                            <button className="absolute size-8 rounded-md p-0.5 right-1 hover:brightness-110" style={{ backgroundColor: color }} onClick={() => onAddLaunchMod?.(launchArgs)}>
                                <AddIcon className="size-full"/>
                            </button>
                        </Tippy>
                    </div>
                    <div className={cn("flex gap-2 flex-wrap")}>
                        {launchMods?.map((mod) => (
                            <LaunchModItem key={mod.id} {...mod}/>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export type CustomLaunchOption = {
    readonly id: string;
    readonly label: string;
    readonly data: {
        readonly command?: string;
    }
}

export type LaunchModItemProps = {
    readonly id: string;
    readonly icon?: SvgIcon;
    readonly label: string;
    readonly description?: string;
    readonly active: boolean;
    readonly visible?: boolean;
    readonly pinned?: boolean;
    readonly onChange?: (val: boolean) => void;
    readonly onPinChange?: (val: boolean) => void;
    readonly onEdit?: () => void;
    readonly onDelete?: () => void;
}

export function LaunchModItem({ id, icon: Icon, label, description, active, visible, pinned, onChange, onPinChange, onEdit, onDelete }: LaunchModItemProps) {

    const { text: t } = useTranslationV2();

    return (
        <Tippy theme="default" className="break-words" placement="top" content={description ?? null} disabled={!description}>
            <div id={id} className={cn("grow rounded-md bg-theme-1 relative flex justify-center items-center h-10 py-1 px-3", visible === false && "hidden")} onClick={e => { e.preventDefault(); e.stopPropagation(); onChange?.(!active) }}>
                <BsmCheckbox className="h-4 aspect-square z-[1] relative mr-1.5" checked={active} onChange={onChange}/>
                {Icon && <Icon className="h-full w-fit py-0.5 mr-1.5 text-gray-800 dark:text-gray-200"/>}
                <span className="font-bold text-gray-800 dark:text-gray-200">{label}</span>
                {onPinChange && (
                    <Tippy theme="default" placement="right" content={pinned ? t("misc.unpin") : t("misc.pin")} hideOnClick>
                        <button className="h-full py-2 px-1.5" onClick={e => { e.preventDefault(); e.stopPropagation(); onPinChange?.(!pinned) }}>
                            {pinned
                                ? <UnpinIcon className="size-full text-gray-800 dark:text-gray-200"/>
                                : <PinIcon className="size-full text-gray-800 dark:text-gray-200"/>}
                        </button>
                    </Tippy>
                )}
                {onEdit && (
                    <Tippy theme="default" placement="right" content={t("misc.edit")} hideOnClick>
                        <button className="h-full py-2 px-1" onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit?.() }}>
                            <EditIcon className="size-full text-gray-800 dark:text-gray-200"/>
                        </button>
                    </Tippy>
                )}
                {onDelete && (
                    <Tippy theme="default" placement="right" content={t("misc.delete")} hideOnClick>
                        <button className="h-full py-2 px-1" onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete?.() }}>
                            <TrashIcon className="size-full text-gray-800 dark:text-gray-200"/>
                        </button>
                    </Tippy>
                )}
            </div>
        </Tippy>
    );

}
