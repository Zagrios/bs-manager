import { CSSProperties, useState } from "react";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { ExternalMod } from "shared/models/mods/mod.interface";

import { BsModsManagerService } from "renderer/services/bs-mods-manager.service";
import { PageStateService } from "renderer/services/page-state.service";

import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";

type Props = Readonly<{
    mod: ExternalMod;
    onUninstall: () => void;
}>;

export function ExternalModItem({
    mod,
    onUninstall
}: Props) {
    const modsManagerService = useService(BsModsManagerService);
    const pageStateService = useService(PageStateService);

    const [enabled, setEnabled] = useState(mod.enabled);
    const [selected, setSelected] = useState(false);
    // const [files, setFiles] = useState(mod.files);

    const themeColor = useThemeColor("first-color");
    const uninstalling = useObservable(() => modsManagerService.isUninstalling$);
    const selectedStyle: CSSProperties = {
        borderColor: selected ? themeColor : "transparent"
    };

    const uninstall = async () => {
        const success = await modsManagerService.uninstallExternalMod(mod, pageStateService.getState());
        if (success) {
            onUninstall();
        }
    };

    return (<li
            className="contents bg-light-main-color-3 dark:bg-main-color-1 text-main-color-1 dark:text-light-main-color-1 hover:cursor-pointer group"
            onClick={event => {
                event.preventDefault();
                setSelected(!selected);
            }}
        >
            <div
                className="h-full aspect-square flex items-center justify-center p-[7px] rounded-l-md bg-inherit ml-3 border-2 border-r-0 z-[1] group-hover:brightness-90"
                style={selectedStyle}
            >
                <BsmCheckbox
                    className="h-full aspect-square z-[1] relative bg-inherit"
                    checked={enabled}
                    onChange={setEnabled}/>
            </div>

            <span
                className="bg-inherit py-2 pl-3 font-bold text-sm whitespace-nowrap border-t-2 border-b-2 blur-none group-hover:brightness-90"
                style={selectedStyle}
            >
                {mod.name}
            </span>

            <span
                className="min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 group-hover:brightness-90"
                style={selectedStyle}
            >
                {mod.version || "-"}
            </span>

            <span
                className="min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 group-hover:brightness-90"
                style={selectedStyle}
            />

            <span
                title={mod.description} className="px-3 bg-inherit whitespace-nowrap text-ellipsis overflow-hidden py-2 text-sm border-t-2 border-b-2 group-hover:brightness-90"
                style={selectedStyle}
            >
                {mod.description}
            </span>

            <div
                className="h-full bg-inherit flex items-center justify-center mr-3 rounded-r-md pr-2 border-t-2 border-b-2 border-r-2 group-hover:brightness-90"
                style={selectedStyle}
            >
                <BsmButton
                    className="z-[1] h-7 w-7 p-[5px] rounded-full group-hover:brightness-90"
                    icon="trash"
                    disabled={uninstalling}
                    withBar={false}
                    onClick={e => {
                        e.stopPropagation();
                        uninstall();
                    }}
                />
            </div>
        </li>)
}

