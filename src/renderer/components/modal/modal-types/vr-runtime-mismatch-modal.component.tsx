import { useState } from "react";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmLink } from "renderer/components/shared/bsm-link.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";

export const VrRuntimeMismatchModal: ModalComponent<boolean> = ({ resolver }) => {
    const t = useTranslation();
    const [dontRemindAgain, setDontRemindAgain] = useState(false);
    const activeRuntime = t("modals.vr-runtime-mismatch.runtimes.unknown");

    return (
        <form className="text-gray-800 dark:text-gray-200 flex flex-col min-w-[350px]">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.vr-runtime-mismatch.title")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <div className="flex flex-col gap-3">
                <p>{t("modals.vr-runtime-mismatch.body.active-runtime", { activeRuntime })}</p>
                <p className="text-sm italic">{t("modals.vr-runtime-mismatch.body.info")}</p>
                <p className="text-sm">{t("modals.vr-runtime-mismatch.body.info-2")}</p>
            </div>
            <div className="flex justify-start items-center *:underline *:text-sm *:text-neutral-200">
                <BsmLink href="https://github.com/Zagrios/bs-manager/wiki/Configure-OpenXR-Runtime">
                    {t("modals.vr-runtime-mismatch.tutorial")}
                </BsmLink>
            </div>
            <div className="flex flex-row justify-start items-center gap-1.5 my-4">
                <BsmCheckbox className="relative z-[1] w-6 aspect-square" checked={dontRemindAgain} onChange={setDontRemindAgain} />
                <span>{t("modals.vr-runtime-mismatch.dont-remind-me")}</span>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4">
                <BsmButton typeColor="cancel" className="rounded-md text-center flex items-center justify-center transition-all h-8" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center flex items-center justify-center transition-all h-8" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED, data: dontRemindAgain })} withBar={false} text="modals.vr-runtime-mismatch.launch-anyway" />
            </div>
        </form>
    );
};
