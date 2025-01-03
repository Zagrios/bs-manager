import { motion } from "framer-motion";
import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { BbmCategories, BbmFullMod } from "shared/models/mods/mod.interface";
import { ModItem } from "./mod-item.component";

type Props = {
    modsMap: Map<BbmCategories, BbmFullMod[]>;
    installed: Map<BbmCategories, BbmFullMod[]>;
    modsSelected: BbmFullMod[];
    onModChange: (selected: boolean, mod: BbmFullMod) => void;
    moreInfoMod?: BbmFullMod;
    onWantInfos: (mod: BbmFullMod) => void
    disabled?: boolean;
    uninstallMod?: (mods: BbmFullMod) => void;
    uninstallAllMods?: () => void;
    unselectAllMods?: () => void;
    openModsDropZone?: () => void;
};

export function ModsGrid({ modsMap, installed, modsSelected, onModChange, moreInfoMod, onWantInfos, disabled, uninstallMod, uninstallAllMods, unselectAllMods, openModsDropZone }: Props) {

    const [filter, setFilter] = useState("");
    const [filterEnabled, setFilterEnabled] = useState(false);
    const { text: t } = useTranslationV2();

    const installedModVersion = (key: BbmCategories, mod: BbmFullMod): string => {
        if (!installed?.get(key)) {
            return undefined;
        }
        const installedMod = installed.get(key).find(m => m.mod.id === mod.mod.id);
        if (!installedMod) {
            return undefined;
        }
        return installedMod.version.modVersion;
    };

    const getAvailableMods = (): BbmFullMod[] => {
        return Array.from(modsMap.values()).flat();
    }

    const isDependency = (mod: BbmFullMod): boolean => {
        const selectedModsDepsIds = modsSelected.flatMap(m => m.version.dependencies);
        const modsDeps = getAvailableMods().filter(m => selectedModsDepsIds.includes(m.version.id));
        const modsDepsDepsIds = modsDeps.flatMap(m => m.version.dependencies);
        return selectedModsDepsIds.includes(mod.version.id) || modsDepsDepsIds.includes(mod.version.id);
    };

    const isSelected = (mod: BbmFullMod): boolean => modsSelected.some(m => m.mod.id === mod.mod.id);

    const handleInput = (val: string) => setFilter(val.toLowerCase());

    const handleToogleFilter = () => {
        setFilter("");
        setFilterEnabled(b => !b);
    };

    return (
        modsMap && (
            <div className="grid gap-y-1 grid-cols-[40px_min-content_min-content_min-content_1fr_min-content] bg-light-main-color-2 dark:bg-main-color-2 text-main-color-1 dark:text-light-main-color-1">
                <span className="absolute z-10 top-0 w-full h-8 bg-inherit rounded-tl-md" />
                <span className="z-10 sticky flex items-center justify-end top-0 bg-inherit border-b-2 border-main-color-1 rounded-tl-md">
                    <BsmButton className="rounded-full h-6 w-6 p-[2px]" withBar={false} icon="search" onClick={handleToogleFilter} />
                </span>
                <span className="z-10 sticky top-0 flex items-center bg-inherit border-main-color-1 border-b-2 h-8 px-1 whitespace-nowrap">{filterEnabled ? <motion.input autoFocus className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md h-6 px-2" initial={{ width: 0 }} animate={{ width: "250px" }} transition={{ ease: "easeInOut", duration: 0.15 }} onChange={e => handleInput(e.target.value)} /> : <span className="w-full text-center">{t("pages.version-viewer.mods.mods-grid.header-bar.name")}</span>}</span>
                <span className="z-10 sticky flex items-center justify-center top-0 bg-inherit border-b-2 border-main-color-1 h-8 px-2 whitespace-nowrap">{t("pages.version-viewer.mods.mods-grid.header-bar.installed")}</span>
                <span className="z-10 sticky flex items-center justify-center top-0 bg-inherit border-b-2 border-main-color-1 h-8 px-2 whitespace-nowrap">{t("pages.version-viewer.mods.mods-grid.header-bar.latest")}</span>
                <span className="z-10 sticky flex items-center justify-center top-0 bg-inherit border-b-2 border-main-color-1 h-8 whitespace-nowrap">{t("pages.version-viewer.mods.mods-grid.header-bar.description")}</span>
                <span className="z-10 sticky top-0 bg-inherit border-b-2 border-main-color-1 h-8 flex justify-start items-center py-1 pl-[3px] min-w-[50px]">
                    <BsmDropdownButton className="h-full aspect-square relative rounded-full bg-light-main-color-1 dark:bg-main-color-3" withBar={false} icon="three-dots" buttonClassName="!rounded-full !p-[2px] !bg-light-main-color-2 dark:!bg-main-color-2 hover:!bg-light-main-color-1 dark:hover:!bg-main-color-3" menuTranslationY="5px" items={[
                        { text: "pages.version-viewer.mods.mods-grid.header-bar.dropdown.import-mods", icon: "download", onClick: () => openModsDropZone?.() },
                        { text: "pages.version-viewer.mods.mods-grid.header-bar.dropdown.unselect-all", icon: "cancel", onClick: () => unselectAllMods?.() },
                        { text: "pages.version-viewer.mods.mods-grid.header-bar.dropdown.uninstall-all", icon: "trash", onClick: () => uninstallAllMods?.() }
                    ]} />
                </span>

                {Array.from(modsMap.keys()).map(key => modsMap.get(key).some(mod => mod.mod.name.toLowerCase().includes(filter)) && (
                            <ul key={key} className="contents">
                                <h2 className="col-span-full py-1 font-bold pl-3">{key}</h2>
                                {modsMap.get(key).map(mod => mod.mod.name.toLowerCase().includes(filter) && (
                                    <ModItem
                                        key={mod.mod.id}
                                        className="contents bg-light-main-color-3 dark:bg-main-color-1 text-main-color-1 dark:text-light-main-color-1 hover:cursor-pointer"
                                        mod={mod}
                                        installedVersion={installedModVersion(key, mod)}
                                        isDependency={isDependency(mod)}
                                        isSelected={isSelected(mod)}
                                        onChange={val => onModChange(val, mod)}
                                        onWantInfo={onWantInfos}
                                        wantInfo={mod.mod.id === moreInfoMod?.mod.id}
                                        disabled={disabled}
                                        onUninstall={() => uninstallMod?.(mod)} />
                                ))}
                            </ul>
                        )
                )}
            </div>
        )
    );
}
