import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatConflict from "../../../../../../assets/images/apngs/beat-conflict.png";
import { BPList } from "shared/models/playlists/playlist.interface";
import Tippy from "@tippyjs/react";

export const ExportPlaylistModal: ModalComponent<boolean, BPList[]> = ({ resolver, options: { data }}) => {

    const t = useTranslation();

    const [exportMaps, setExportMaps] = useState(false);
    const isMultiple = data.length > 1;

    return (
        <form className="max-w-sm text-gray-800 dark:text-gray-200">
            {!isMultiple ? (
                <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("playlist.export-playlist-ask")}</h1>
            ) : (
                <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("playlist.export-playlists-ask")}</h1>
            )}
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            {!isMultiple ? (
                <p className="w-full">{t("playlist.export-playlist-desc", { playlistTitle: data.at(0)?.playlistTitle })}</p>
            ) : (
                <p className="w-full">{t("playlist.export-playlists-desc", { nb: `${data.length ?? 0}` })}</p>
            )}

            <div className="flex items-center relative py-2 gap-1">
                <BsmCheckbox className="h-5 relative z-[1]" checked={exportMaps} onChange={val => setExportMaps(() => val)} />
                <Tippy
                    placement="top"
                    content={isMultiple ? t("playlist.export-playlists-maps-tip") : t("playlist.export-playlist-maps-tip")}
                    theme="default"
                >
                    <span className="italic cursor-help">{t("playlist.export-maps")}</span>
                </Tippy>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-2">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED, data: exportMaps })} withBar={false} text="playlist.export" />
            </div>
        </form>
    );
};
