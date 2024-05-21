import { ModalComponent, ModalExitCode } from "renderer/services/modale.service"
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { useState } from "react";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export const OriginalOculusVersionBackupModal: ModalComponent<boolean, void> = ({ resolver }) => {

    const t = useTranslation();
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const submit = () => {
        resolver({ exitCode: ModalExitCode.COMPLETED, data: dontShowAgain });
    }

    return (
        <form className="max-w-[450px] text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.original-version-backup-oculus.title")}</h1>
            <BsmImage className="mx-auto h-20" image={BeatConflict} />

            <p className="text-sm italic mb-4 font-bold">{t("modals.original-version-backup-oculus.body.must-be-installed-once")}</p>
            <p className="mb-4">{t("modals.original-version-backup-oculus.body.will-backup")}</p>

            <div className="flex flex-row justify-start items-center gap-1.5 my-4" >
                <BsmCheckbox className="relative z-[1] w-6 aspect-square" checked={dontShowAgain} onChange={setDontShowAgain} />
                <span>{t("modals.original-version-backup-oculus.not-remind-me")}</span>
            </div>

            <div className="grid grid-flow-col grid-cols-2 gap-4">
                <BsmButton
                    typeColor="cancel"
                    className="rounded-md transition-all h-10 flex items-center justify-center"
                    onClick={() => {
                        resolver({ exitCode: ModalExitCode.CANCELED });
                    }}
                    withBar={false}
                    text="misc.cancel"
                />
                <BsmButton
                    typeColor="primary"
                    className="rounded-md transition-all h-10 flex items-center justify-center"
                    onClick={submit}
                    withBar={false}
                    text="modals.original-version-backup-oculus.understood"
                />
            </div>
        </form>
    )
}
