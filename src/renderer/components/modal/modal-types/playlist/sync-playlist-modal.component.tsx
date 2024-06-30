import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatConflict from "../../../../../../assets/images/apngs/beat-conflict.png";
import { BPList } from "shared/models/playlists/playlist.interface";

export const SyncPlaylistModal: ModalComponent<boolean, BPList[]> = ({ resolver, options: { data }}) => {

    const t = useTranslation();

    return (
        <form className="max-w-sm text-gray-800 dark:text-gray-200 overflow-hidden">
            {data.length === 1 ? (
                <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("playlist.synchronize-playlist-ask")}</h1>
            ) : (
                <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("playlist.synchronize-playlists-ask")}</h1>
            )}
            <BsmImage className="mx-auto h-24" image={BeatConflict} />

            {data.length === 1 ? (
                <p className="w-full">{t("playlist.synchronize-playlist-desc", { playlistTitle: data.at(0)?.playlistTitle })}</p>
            ) : (
                <p className="w-full">{t("playlist.synchronize-playlists-desc", { nb: `${data.length ?? 0}` })}</p>
            )}

            <p className="w-full py-2 italic text-sm">{t("playlist.synchronize-playlist-tip")}</p>

            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-2">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED })} withBar={false} text="playlist.synchronize" />
            </div>
        </form>
    );
};
