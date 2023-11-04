import { ModalComponent, ModalExitCode } from "renderer/services/modale.service"
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { useState } from "react";

export const OriginalOculusVersionBackupModal: ModalComponent<boolean, void> = ({ resolver }) => {

    const [dontShowAgain, setDontShowAgain] = useState(false);

    const submit = () => {
        resolver({ exitCode: ModalExitCode.COMPLETED, data: dontShowAgain });
    }

    // TODO : Translate

    return (
        <form className="max-w-[450px] text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">Attention</h1>
            <BsmImage className="mx-auto h-20" image={BeatConflict} />
            
            <p className="mb-4">Pour lancer cette version, le dossier d'installation de Beat Saber se trouvant dans votre librairie Oculus va être renommé.</p>
            <p className="mb-4">Au besoin, vous pourrez le restaurer depuis BSManager en vous rendant dans les options de la version originale et en cliquant sur "Restaurer le dossier"</p>
            <p className="text-sm italic mb-4">Astuce : Vous pourrez lancer cette version directement depuis Oculus, tant que la version originale n'est pas restaurée.</p>

            <div className="flex flex-row justify-start items-center gap-1.5 my-4" >
                <BsmCheckbox className="relative z-[1] w-6 aspect-square" checked={dontShowAgain} onChange={setDontShowAgain} />
                <span>Ne plus me rappler</span>
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
                    text="J'ai compris"
                />
            </div>
        </form>
    )
}
