import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";
import { BSVersion } from "shared/bs-version.interface";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { useState } from "react";
import { ConfigurationService } from "renderer/services/configuration.service";
import { useService } from "renderer/hooks/use-service.hook";

export const BSVersionOutdatedModal: ModalComponent<void, { outdated: BSVersion, recommended: BSVersion }> = ({ resolver, data : { outdated, recommended }}) => {

    const t = useTranslationV2();
    const config = useService(ConfigurationService);

    const [remember, setRemember] = useState(false);

    const handleContinue = () => {
        if (remember) {
            config.set("not-show-bs-version-outdated-modal", true);
        }

        resolver({ exitCode: ModalExitCode.COMPLETED });
    };

    return (
        <form className="text-gray-800 dark:text-gray-200 max-w-sm">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t.text("misc.warning")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p>{t.element("modals.bs-version-outdated.body", { outdatedVersion: <b>{outdated.BSVersion}</b>, recommendedVersion: <b>{recommended.BSVersion}</b> })}</p>
            <div className="flex items-center relative py-2 gap-1 mt-1">
                    <BsmCheckbox className="h-5 relative z-[1]" checked={remember} onChange={val => setRemember(() => val)} />
                    <span className="italic">{t.text("modals.misc.remember-my-choice")}</span>
                </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4 h-8">
                <BsmButton typeColor="cancel" className="rounded-md flex justify-center items-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md flex justify-center items-center transition-all" onClick={handleContinue} withBar={false} text="misc.continue" />
            </div>
        </form>
    );
};
