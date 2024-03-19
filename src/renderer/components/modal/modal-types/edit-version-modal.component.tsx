import { useState } from "react";
import SettingColorChooser from "renderer/components/settings/setting-color-chooser.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmIcon } from "renderer/components/svgs/bsm-icon.component";
import { DefaultConfigKey } from "renderer/config/default-configuration.config";
import { useService } from "renderer/hooks/use-service.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ConfigurationService } from "renderer/services/configuration.service";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { BSVersion } from "shared/bs-version.interface";

export const EditVersionModal: ModalComponent<{ name: string; color: string }, { version: BSVersion; clone?: boolean }> = ({ resolver, data }) => {
    const { version, clone } = data;

    const configService = useService(ConfigurationService);

    const [name, setName] = useState(version.name || version.BSVersion);
    const [color, setColor] = useState(version.color ?? configService.get<string>("second-color" as DefaultConfigKey));
    const t = useTranslation();

    const rename = () => {
        if (!name) {
            return;
        }
        resolver({ exitCode: ModalExitCode.COMPLETED, data: { name: name.trim(), color } });
    };

    const resetColor = () => {
        setColor(configService.get("second-color" as DefaultConfigKey));
    };

    const resetName = () => {
        setName(version.BSVersion);
    };

    return (
        <form
            className="static"
            onSubmit={e => {
                e.preventDefault();
                rename();
            }}
        >
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t(!clone ? "modals.edit-version.title" : "modals.clone-version.title")}</h1>
            <BsmIcon className="w-full h-11 my-3" icon="bsNote" style={{ color }} />
            {clone && <p className="max-w-sm mb-2 text-gray-800 dark:text-gray-200">{t("modals.clone-version.description")}</p>}
            <div className="mb-3">
                <label className="block font-bold cursor-pointer tracking-wide text-gray-800 dark:text-gray-200" htmlFor="name">
                    {t("modals.clone-version.inputs.name.label")}
                </label>
                <div className="relative">
                    <input className="w-full bg-light-main-color-1 dark:bg-main-color-1 px-1 py-[2px] rounded-md outline-none" onChange={e => setName(e.target.value)} value={name} type="text" name="name" id="name" minLength={2} maxLength={15} placeholder={t("modals.clone-version.inputs.name.placeholder")} />
                    <div className="absolute right-2 top-0 h-full flex items-center">
                        <BsmButton onClick={resetName} className="px-2 font-bold italic text-sm rounded-md" text="pages.settings.appearance.reset" withBar={false} />
                    </div>
                </div>
            </div>
            <div>
                <span className="block font-bold tracking-wide text-gray-800 dark:text-gray-200">{t("modals.clone-version.inputs.color.label")}</span>
                <div className="relative w-full h-7 mb-4 bg-light-main-color-1 dark:bg-main-color-1 flex justify-center rounded-md py-1 z-[1]">
                    <SettingColorChooser color={color} onChange={setColor} pickerClassName="!h-28" />
                    <div className="absolute right-2 top-0 h-full flex items-center">
                        <BsmButton onClick={resetColor} className="px-2 font-bold italic text-sm rounded-md" text="pages.settings.appearance.reset" withBar={false} />
                    </div>
                </div>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4">
                <BsmButton
                    typeColor="cancel"
                    className="rounded-md text-center transition-all"
                    onClick={() => {
                        resolver({ exitCode: ModalExitCode.CANCELED });
                    }}
                    withBar={false}
                    text="misc.cancel"
                />
                <BsmButton typeColor="primary" className="z-0 px-1 rounded-md text-center transition-all" type="submit" withBar={false} text={!clone ? "modals.edit-version.buttons.submit" : "modals.clone-version.buttons.submit"} />
            </div>
        </form>
    );
};
