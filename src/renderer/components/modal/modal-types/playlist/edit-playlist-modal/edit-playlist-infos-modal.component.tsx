import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useState } from "react";
import { useService } from "renderer/hooks/use-service.hook";
import { SteamDownloaderService } from "renderer/services/bs-version-download/steam-downloader.service";
import { IpcService } from "renderer/services/ipc.service";
import { lastValueFrom } from "rxjs";
import { logRenderError } from "renderer";
import { useTranslation } from "renderer/hooks/use-translation.hook";

type OutProps = {
    playlistTitle: string;
    playlistDescription: string;
    playlistAuthor: string;
    base64Image: string;
}

type Props = OutProps & { isEdit: boolean };

export const EditPlaylistInfosModal: ModalComponent<OutProps, Props> = ({ resolver, options: { data: {
    playlistTitle,
    playlistDescription,
    playlistAuthor,
    base64Image,
    isEdit
}}}) => {

    const t = useTranslation();

    const steamDownloader = useService(SteamDownloaderService);
    const ipc = useService(IpcService);

    const [title, setTitle] = useState(playlistTitle);
    const [description, setDescription] = useState(playlistDescription);
    const [author, setAuthor] = useState(playlistAuthor ?? steamDownloader.getSteamUsername());
    const [base64, setBase64] = useState(base64Image);

    const handleClickImage = async () => {
        const res = await lastValueFrom(ipc.sendV2("choose-image", { base64: true })).catch(logRenderError) as string[];
        setBase64(prev => res?.at(0) ?? prev);
    }

    const submit = () => {
        resolver({
            exitCode: ModalExitCode.COMPLETED,
            data: {
                playlistTitle: title,
                playlistDescription: description,
                playlistAuthor: author,
                base64Image: base64
            }
        });
    };

    return (
        <div className="text-gray-800 dark:text-gray-200 min-w-80">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center mb-4 px-4">
                {isEdit ? t("playlist.edit-playlist") : t("playlist.create-a-playlist")}
            </h1>
            <div className="w-full flex flex-col justify-center items-center">
                <button className="flex justify-center items-center relative size-36 border-2 border-gray-400 bg-theme-1 rounded-md overflow-hidden" onClick={handleClickImage}>
                    {base64 ? (
                        <BsmImage className="absolute size-full cursor-pointer" base64={base64} />
                    ) : (
                        <span className="absolute size-full flex justify-center items-center p-2">{t("playlist.choose-image")}</span>
                    )}
                </button>
                <div className="w-full">
                    <label className="font-bold cursor-pointer tracking-wide" htmlFor="playlist-title">{t("playlist.title")}</label>
                    <input id="playlist-title" type="text" className="w-full bg-theme-1 px-1 py-0.5 rounded-md outline-none h-9" value={title} placeholder={t("playlist.playlist-title")} onChange={e => setTitle(e.target.value)}/>
                </div>
                <div className="w-full mt-1.5">
                    <label className="font-bold cursor-pointer tracking-wide" htmlFor="playlist-desc">{t("playlist.description")}</label>
                    <textarea id="playlist-desc" className="w-full bg-theme-1 px-1 py-0.5 rounded-md outline-none max-h-40 min-h-8" value={description} placeholder={t("playlist.playlist-description")} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="w-full">
                    <label className="font-bold cursor-pointer tracking-wide" htmlFor="playlist-author">{t("playlist.author")}</label>
                    <input id="playlist-author" type="text" className="w-full bg-theme-1 px-1 py-0.5 rounded-md outline-none h-9" value={author} placeholder={t("playlist.playlist-author")} onChange={e => setAuthor(e.target.value)}/>
                </div>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4 h-8">
                <BsmButton typeColor="cancel" className="rounded-md flex justify-center items-center transition-all h-full" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md flex justify-center items-center transition-all h-full" onClick={submit} withBar={false} text="playlist.save" />
            </div>
        </div>
    )
}
