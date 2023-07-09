import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";

export const InstallationFolderModal: ModalComponent<void> = ({ resolver }) => {
    const t = useTranslation();

    return (
        <form>
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.install-folder.title")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p className="max-w-sm text-gray-800 dark:text-gray-200">{t("modals.install-folder.description")}</p>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED })} withBar={false} text="modals.install-folder.buttons.submit" />
            </div>
        </form>
    );
};
