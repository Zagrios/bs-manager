import { BsmButton } from "renderer/components/shared/bsm-button.component"
import { BsmImage } from "renderer/components/shared/bsm-image.component"
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service"
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { useState } from "react";

export const NeedLaunchAdminModal: ModalComponent<boolean, void> = ({resolver}) => {

    const t = useTranslation();

    const [dontShowAgain, setDontShowAgain] = useState(false);

    return (
        <form className="text-gray-800 dark:text-gray-200 flex flex-col min-w-[350px]">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.launch-as-admin.title")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <div className="flex flex-col gap-3">
                <p className="w-0 min-w-full">{t("modals.launch-as-admin.body.info")}</p>
                <p className="w-0 min-w-full">{t("modals.launch-as-admin.body.info-2")}</p>
                <p className="w-0 min-w-full text-sm italic">{t("modals.launch-as-admin.body.info-3")}</p>
            </div>
            <div className="flex flex-row justify-start items-center gap-1.5 my-4">
                <BsmCheckbox className="relative z-[1] w-6 aspect-square" checked={dontShowAgain} onChange={setDontShowAgain} />
                <span>{t("modals.launch-as-admin.not-remind-me")}</span>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4">
                <BsmButton typeColor="cancel" className="rounded-md text-center flex items-center justify-center transition-all h-8" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center flex items-center justify-center transition-all h-8" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED, data: dontShowAgain })} withBar={false} text="modals.launch-as-admin.launch-as-admin" />
            </div>
        </form>
    )
}
