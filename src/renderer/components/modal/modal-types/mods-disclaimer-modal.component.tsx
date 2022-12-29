import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatConflict from '../../../../../assets/images/apngs/beat-conflict.png'

export const ModsDisclaimerModal: ModalComponent<void, void> = ({resolver}) => {

    const t = useTranslation();

    return (
        <form className="max-w-[800px] text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.mods-disclaimer.title")}</h1>
            <BsmImage className="mx-auto h-20" image={BeatConflict} />
            <p className="mb-1">{t("modals.mods-disclaimer.p-1")}</p>
            <ul className="list-disc w-full pl-6">
                <li>{t("modals.mods-disclaimer.li-1")}</li>
                <li>{t("modals.mods-disclaimer.li-2")}</li>
                <li>{t("modals.mods-disclaimer.li-3")}</li>
            </ul>
            <p className="mt-1">{t("modals.mods-disclaimer.p-2")}</p>
            <div className="grid grid-flow-col grid-cols-2 gap-4 pt-3">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => {resolver({exitCode: ModalExitCode.CANCELED})}} withBar={false} text="misc.refuse"/>
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={() => {resolver({exitCode: ModalExitCode.COMPLETED})}} withBar={false} text="misc.accept"/>
            </div>
        </form>
    )
}