import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";

export const UnlinkPlaylistModal: ModalComponent<boolean> = ({ resolver }) => {
    const t = useTranslation();
    const [keepMaps, setKeepMaps] = useState(true);

    // TODO : Translate

    return (
        <form className="text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">Délier les playlists</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p className="max-w-sm w-full">Attention, délier les playlists ne permettra plus l'utilisation des playlists paratagées pour cette version.</p>
            <div className="relative h-5 flex my-3 items-center">
                <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1.5 z-[1]" checked={keepMaps} onChange={setKeepMaps} />
                <span className="text-sm mb-0.5 cursor-help" title="Conserver les playlists créera une copie des playlists partagées pour la version actuelle. Dans le cas contraire, aucune playlist ne sera conservée pour cette version.">
                    Conserver les playlists
                </span>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="error" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED, data: keepMaps })} withBar={false} text="Délier les playlists" />
            </div>
        </form>
    );
};