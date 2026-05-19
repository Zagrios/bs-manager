import { ModalComponent, ModalExitCode } from "renderer/services/modale.service"
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";

export const EnableOculusSideloadedApps: ModalComponent<void, void> = ({ resolver }) => {

    const { text: t } = useTranslationV2();

    const submit = () => {
        resolver({ exitCode: ModalExitCode.COMPLETED });
    }

    return (
        <form className="max-w-[450px] text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.enable-oculus-sideloaded-apps.title")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />

            <p className="mb-4">{t("modals.enable-oculus-sideloaded-apps.info-1")}</p>
            <p className="mb-4">{t("modals.enable-oculus-sideloaded-apps.info-2")}</p>
            <p className="mb-4">{t("modals.enable-oculus-sideloaded-apps.info-3")}</p>

            <a className="underline mb-5 block" href="https://github.com/Zagrios/bs-manager/wiki/Activate-Oculus-sideloading" target="_blank">{t("modals.enable-oculus-sideloaded-apps.i-want-to-do-it-myself")}</a>

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
                    text="modals.enable-oculus-sideloaded-apps.understood"
                />
            </div>
        </form>
    )
}
