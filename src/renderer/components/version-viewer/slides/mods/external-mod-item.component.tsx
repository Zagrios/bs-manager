import { useRef, useState } from "react";
import { useService } from "renderer/hooks/use-service.hook";
import { useObservable } from "renderer/hooks/use-observable.hook";
import useDoubleClick from "use-double-click";
import { ExternalMod } from "shared/models/mods/mod.interface";

import { BsModsManagerService } from "renderer/services/bs-mods-manager.service";
import { PageStateService } from "renderer/services/page-state.service";

import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";

type Props = Readonly<{
    mod: ExternalMod;
    onCheckboxToggle: (checked: boolean) => void;
    onDoubleClick: () => void;
    onUninstall: () => void;
}>;

export function ExternalModItem({
    mod,
    onCheckboxToggle,
    onDoubleClick,
    onUninstall
}: Props) {
    const modsManagerService = useService(BsModsManagerService);
    const pageStateService = useService(PageStateService);

    const [enabled, setEnabled] = useState(mod.enabled);

    const uninstalling = useObservable(() => modsManagerService.isUninstalling$);
    const clickRef = useRef();

    useDoubleClick({
        onSingleClick: event => {
            event.preventDefault();
            const checked = !enabled;
            setEnabled(checked)
            onCheckboxToggle(checked);
        },
        onDoubleClick: event => {
            event.preventDefault();
            onDoubleClick();
        },
        ref: clickRef,
        latency: 175,
    });

    const uninstall = async () => {
        const success = await modsManagerService.uninstallExternalMod(mod, pageStateService.getState());
        if (success) {
            onUninstall();
        }
    };

    return (
        <li
            ref={clickRef}
            className="contents bg-light-main-color-3 dark:bg-main-color-1 text-main-color-1 dark:text-light-main-color-1 hover:cursor-pointer group"
        >
            <div className="h-full aspect-square flex items-center justify-center p-[7px] rounded-l-md bg-inherit ml-3 border-2 border-r-0 border-transparent z-[1] group-hover:brightness-90">
                <BsmCheckbox
                    className="h-full aspect-square z-[1] relative bg-inherit"
                    checked={enabled}
                    onChange={checked => {
                        setEnabled(checked);
                        onCheckboxToggle(checked);
                    }}/>
            </div>

            <span className="bg-inherit py-2 pl-3 font-bold text-sm whitespace-nowrap border-t-2 border-b-2 border-transparent blur-none group-hover:brightness-90">
                {mod.name}
            </span>

            <span className="min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 border-transparent group-hover:brightness-90">
                {mod.version || "-"}
            </span>

            <span className="min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 border-transparent group-hover:brightness-90"/>

            <span
                title={mod.description}
                className="px-3 bg-inherit whitespace-nowrap text-ellipsis overflow-hidden py-2 text-sm border-t-2 border-b-2 border-transparent group-hover:brightness-90"
            >
                {mod.description}
            </span>

            <div className="h-full bg-inherit flex items-center justify-center mr-3 rounded-r-md pr-2 border-t-2 border-b-2 border-r-2 border-transparent group-hover:brightness-90">
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
        </li>
    )
}

