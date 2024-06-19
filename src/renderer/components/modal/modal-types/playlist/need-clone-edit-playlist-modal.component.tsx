import { ModalComponent, ModalExitCode } from "renderer/services/modale.service"
import BeatConflict from "../../../../../../assets/images/apngs/beat-conflict.png";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";

// TODO : Translate

export const NeedCloneEditPlaylistModal: ModalComponent<void, void> = ({ resolver }) => {

    return (
        <form className="text-gray-800 dark:text-gray-200 flex flex-col gap-2 max-w-sm">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">Attention</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p className="w-full">Cette playlist a été téléchargée depuis un site externe et contient un lien de synchronisation.</p>
            <p className="w-full">Pour éviter de perdre vos modifications lors d'une synchronisation, la playlist va être dupliquée et son lien de synchronisation supprimé.</p>
            <p className="w-full">Vous pourrez ensuite, si vous le souhaitez, supprimer la playlist originale.</p>
            <div className="grid grid-flow-col grid-cols-2 gap-2 mt-2 h-8">
                <BsmButton typeColor="cancel" className="rounded-md flex justify-center items-center transition-all h-full" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md flex justify-center items-center transition-all h-full" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED })} withBar={false} text="J'ai compris" />
            </div>
        </form>
    );
}
