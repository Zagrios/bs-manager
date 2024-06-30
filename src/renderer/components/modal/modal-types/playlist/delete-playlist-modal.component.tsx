import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatConflict from "../../../../../../assets/images/apngs/beat-conflict.png";
import { BPList } from "shared/models/playlists/playlist.interface";
import Tippy from "@tippyjs/react";

export const DeletePlaylistModal: ModalComponent<boolean, BPList[]> = ({ resolver, options: { data }}) => {

    const t = useTranslation();

    const [deleteMaps, setDeleteMaps] = useState(false);
    const isMultiple = data.length > 1;

    return (
        <form className="text-gray-800 dark:text-gray-200">
            {!isMultiple ? (
                <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("playlist.delete-playlist-ask")}</h1>
            ) : (
                <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("playlist.delete-playlists-ask")}</h1>
            )}
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            {!isMultiple ? (
                <p className="max-w-sm w-full">{t("playlist.delete-playlist-desc", { playlistTitle: data.at(0)?.playlistTitle })}</p>
            ) : (
                <p className="max-w-sm w-full">{t("playlist.delete-playlists-desc", { nb: `${data?.length ?? 0}` })}</p>
            )}

            <div className="flex items-center relative py-2 gap-1">
                <BsmCheckbox className="h-5 relative z-[1]" checked={deleteMaps} onChange={val => setDeleteMaps(() => val)} />
                <Tippy placement="top" content={isMultiple ? t("playlist.delete-playlists-maps-tip") : t("playlist.delete-playlist-maps-tip")} theme="default">
                    <span className="italic cursor-help">{t("playlist.delete-maps")}</span>
                </Tippy>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-2">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED, data: deleteMaps })} withBar={false} text="misc.delete" />
            </div>
        </form>
    );
};
