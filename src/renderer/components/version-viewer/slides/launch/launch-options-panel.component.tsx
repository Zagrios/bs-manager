import Tippy from "@tippyjs/react";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { PinIcon } from "renderer/components/svgs/icons/pin-icon.component";
import { UnpinIcon } from "renderer/components/svgs/icons/unpin-icon.component";
import { SvgIcon } from "renderer/components/svgs/svg-icon.type";
import { cn } from "renderer/helpers/css-class.helpers";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { LaunchMod } from "shared/models/bs-launch/launch-option.interface";

type Props = {
    readonly className?: string;
    readonly open: boolean;
    readonly launchArgs?: string;
    readonly launchMods?: LaunchModItemProps[];
    readonly onLaunchArgsChange?: (args: string) => void;
};

export function LaunchOptionsPanel({ className, open, launchArgs, launchMods, onLaunchArgsChange }: Props) {

    const {text: t} = useTranslationV2();

    return (
        <div className={cn("grid grid-rows-[0fr] transition-[grid-template-rows] bg-theme-2 rounded-md shadow-md shadow-black overflow-hidden", open && "!grid-rows-[1fr]", className)}>
            <div className="flex flex-col overflow-y-scroll scrollbar-default">
                <div className="p-3.5">
                    <input className="h-10 w-full rounded-md bg-theme-1 text-center mb-2" type="text" placeholder={t("pages.version-viewer.launch-mods.advanced-launch.placeholder")} value={launchArgs} onChange={e => onLaunchArgsChange(e.target.value)}/>
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

export type LaunchModItemProps = {
    readonly id: LaunchMod;
    readonly icon?: SvgIcon;
    readonly label: string;
    readonly description: string;
    readonly active: boolean;
    readonly visible?: boolean;
    readonly pinned?: boolean;
    readonly onChange?: (val: boolean) => void;
    readonly onPinChange?: (val: boolean) => void;
}

export function LaunchModItem({ id, icon: Icon, label, description, active, visible, pinned, onChange, onPinChange }: LaunchModItemProps) {

    const { text: t } = useTranslationV2();

    return (
        <Tippy theme="default" className="break-words" placement="top" content={description}>
            <button id={id} className={cn("grow rounded-md bg-theme-1 relative flex justify-center items-center h-10 py-1 px-3", visible === false && "hidden")} onClick={e => { e.preventDefault(); e.stopPropagation(); onChange?.(!active) }}>
                <BsmCheckbox className="h-4 aspect-square z-[1] relative mr-1.5" checked={active} onChange={onChange}/>
                {Icon && <Icon className="h-full w-fit py-0.5 mr-1.5"/>}
                <span className="font-bold">{label}</span>
                {onPinChange && (
                    <Tippy theme="default" placement="right" content={pinned ? t("misc.unpin") : t("misc.pin")} hideOnClick>
                        <button className="h-full py-2 px-1.5" onClick={e => { e.preventDefault(); e.stopPropagation(); onPinChange?.(!pinned) }}>
                            {pinned ? <UnpinIcon className="size-full"/> : <PinIcon className="size-full"/>}
                        </button>
                    </Tippy>
                )}
            </button>
        </Tippy>
    );

}
