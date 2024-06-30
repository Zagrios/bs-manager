import { ModalComponent, ModalExitCode } from "renderer/services/modale.service"
import BeatConflict from "../../../../../../assets/images/apngs/beat-conflict.png";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export const NeedCloneEditPlaylistModal: ModalComponent<void, void> = ({ resolver }) => {

    const t = useTranslation();

    return (
        <form className="text-gray-800 dark:text-gray-200 flex flex-col gap-2 max-w-sm">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("playlist.need-clone-title")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p className="w-full">{t("playlist.need-clone-desc-1")}</p>
            <p className="w-full">{t("playlist.need-clone-desc-2")}</p>
            <p className="w-full">{t("playlist.need-clone-desc-3")}</p>
            <div className="grid grid-flow-col grid-cols-2 gap-2 mt-2 h-8">
                <BsmButton typeColor="cancel" className="rounded-md flex justify-center items-center transition-all h-full" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md flex justify-center items-center transition-all h-full" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED })} withBar={false} text="playlist.understood" />
            </div>
        </form>
    );
}
