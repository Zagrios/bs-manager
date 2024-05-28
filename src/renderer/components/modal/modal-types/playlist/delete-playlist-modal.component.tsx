import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatConflict from "../../../../../../assets/images/apngs/beat-conflict.png";
import { BPList } from "shared/models/playlists/playlist.interface";
import Tippy from "@tippyjs/react";

export const DeletePlaylistModal: ModalComponent<boolean, BPList> = ({ resolver, options: { data }}) => {

    const t = useTranslation();

    const [deleteMaps, setDeleteMaps] = useState(false);

    return (
        <form className="text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">Supprimer la playlist ?</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p className="max-w-sm w-full">{`Est-tu sûr de vouloir supprimer la playlist "${data.playlistTitle}" ?`}</p>
            <div className="flex items-center relative py-2 gap-1">
                <BsmCheckbox className="h-5 relative z-[1]" checked={deleteMaps} onChange={val => setDeleteMaps(() => val)} />
                <Tippy placement="top" content="Si activé, toutes les maps de la playlist seront supprimées" theme="default">
                    <span className="italic cursor-help">Supprimer les maps</span>
                </Tippy>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-2">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED, data: deleteMaps })} withBar={false} text="misc.delete" />
            </div>
        </form>
    );
};