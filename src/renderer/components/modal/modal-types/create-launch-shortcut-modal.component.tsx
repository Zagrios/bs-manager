import { ModalComponent, ModalExitCode } from "renderer/services/modale.service"
import { BSVersion } from "shared/bs-version.interface"
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { LaunchOption } from "shared/models/bs-launch";
import { useService } from "renderer/hooks/use-service.hook";
import { BSLauncherService } from "renderer/services/bs-launcher.service";
import { useState } from "react";
import { BsNoteFill } from "renderer/components/svgs/icons/bs-note-fill.component";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { ChevronTopIcon } from "renderer/components/svgs/icons/chevron-top-icon.component";
import Tippy from "@tippyjs/react";

export const CreateLaunchShortcutModal: ModalComponent<LaunchOption, BSVersion> = ({resolver, options: {data}}) => {

    const bsLauncher = useService(BSLauncherService);

    const t = useTranslation();
    const color = useThemeColor("second-color");

    const [launchOptions, setLaunchOptions] = useState(bsLauncher.getLaunchOptions(data));
    const [advanced, setAdvanced] = useState(!!launchOptions.additionalArgs?.length);
    const [additionalArgsString, setAdditionalArgsString] = useState(launchOptions.additionalArgs?.join("; ") ?? "");

    const completeModal = () => {

        if(advanced) {
            launchOptions.additionalArgs = additionalArgsString.split(";").map(arg => arg.trim()).filter(arg => arg.length);
        } else {
            launchOptions.additionalArgs = undefined;
        }

        resolver({exitCode: ModalExitCode.COMPLETED, data: launchOptions});
    }

    return (
        <form className="text-gray-800 dark:text-gray-200 max-w-lg" onSubmit={e => e.preventDefault()}>
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.create-launch-shortcut.title")}</h1>
            <p className="my-5">{t("modals.create-launch-shortcut.desc")}</p>
            <div className="flex justify-center my-5 gap-3 items-center">
                <BsNoteFill className="aspect-square h-16" style={{color: data.color ?? color}}/>
                <div className="flex flex-col">
                    <span className="dark:text-neutral-300 tracking-wide italic">Beat Saber</span>
                    <span className="font-bold text-3xl">{[data.BSVersion, data.name].join(" ")}</span>
                </div>
            </div>
            <h2 className="font-bold">{t("modals.create-launch-shortcut.launch-options")}</h2>
            <div className="mb-1 grid grid-flow-col gap-3 w-full rounded-md py-2 bg-light-main-color-1 dark:bg-main-color-1">
                {data.oculus !== true && (
                    <div className="h-full flex justify-center items-center gap-2">
                        <BsmCheckbox className="h-5 aspect-square relative z-[1]" checked={launchOptions.oculus} onChange={e => setLaunchOptions({...launchOptions, oculus: e})} />
                        <Tippy className="!bg-main-color-1" content={t("pages.version-viewer.launch-mods.oculus-description")} delay={[300, 0]} arrow={false}>
                            <span className="font-bold cursor-help">{t("pages.version-viewer.launch-mods.oculus")}</span>
                        </Tippy>
                    </div>
                )}
                <div className="h-full flex justify-center items-center gap-2">
                    <BsmCheckbox className="h-5 aspect-square relative z-[1]" checked={launchOptions.desktop} onChange={e => setLaunchOptions({...launchOptions, desktop: e})} />
                    <Tippy className="!bg-main-color-1" content={t("pages.version-viewer.launch-mods.desktop-description")} delay={[300, 0]} arrow={false}>
                        <span className="font-bold cursor-help">{t("pages.version-viewer.launch-mods.desktop")}</span>
                    </Tippy>
                </div>
                <div className="h-full flex justify-center items-center gap-2">
                    <BsmCheckbox className="h-5 aspect-square relative z-[1]" checked={launchOptions.debug} onChange={e => setLaunchOptions({...launchOptions, debug: e})} />
                    <Tippy className="!bg-main-color-1" content={t("pages.version-viewer.launch-mods.debug-description")} delay={[300, 0]} arrow={false}>
                        <span className="font-bold cursor-help">{t("pages.version-viewer.launch-mods.debug")}</span>
                    </Tippy>
                </div>
            </div>
            <div className="w-full rounded-md bg-light-main-color-1 dark:bg-main-color-1">
                <div className="flex items-center justify-between cursor-pointer pl-3 pr-1 py-1" onClick={() => setAdvanced(prev => !prev)}>
                    <span className="font-bold">{t("modals.create-launch-shortcut.advanced-launch")}</span>
                    <ChevronTopIcon className={`h-8 transition-transform ${advanced ? "rotate-180" : ""}`}/>
                </div>
                <div className={`grid grid-rows-[0fr] transition-[grid-template-rows] ${advanced ? "!grid-rows-[1fr]" : ""}`}>
                    <div className="overflow-hidden">
                        <div className="p-2">
                            <input
                                type="text"
                                className="w-full rounded-md text-center outline-none bg-light-main-color-3 dark:bg-main-color-3"
                                placeholder={t("pages.version-viewer.launch-mods.advanced-launch.placeholder")}
                                value={additionalArgsString}
                                onChange={e => setAdditionalArgsString(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-2">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={completeModal} withBar={false} text="modals.create-launch-shortcut.valid-btn" />
            </div>
        </form>
    )
}
