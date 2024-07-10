import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { BsmProgressBar } from "renderer/components/progress-bar/bsm-progress-bar.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import TitleBar from "renderer/components/title-bar/title-bar.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { NotificationService } from "renderer/services/notification.service";
import { PlaylistDownloaderService } from "renderer/services/playlist-downloader.service";
import { map, filter, take, lastValueFrom } from "rxjs";
import defaultImage from "../../../../assets/images/default-version-img.jpg";
import { useService } from "renderer/hooks/use-service.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useWindowArgs } from "renderer/hooks/use-window-args.hook";
import { useWindowControls } from "renderer/hooks/use-window-controls.hook";

export default function OneClickDownloadPlaylist() {


    const t = useTranslation();
    const playlistDownloader = useService(PlaylistDownloaderService);
    const notification = useService(NotificationService);

    const { close: closeWindow } = useWindowControls();
    const mapsContainer = useRef<HTMLDivElement>(null);
    const { playlistUrl } = useWindowArgs("playlistUrl");
    const download$ = useConstant(() => playlistDownloader.oneClickInstallPlaylist(playlistUrl));
    const playlistInfos = useObservable(() => download$.pipe(filter(progress => !!progress.data?.playlist), map(progress => progress.data.playlist), take(1)));
    const downloadedMaps = useObservable(() => download$.pipe(filter(progress => !!progress.data?.downloadedMaps), map(progress => progress.data.downloadedMaps)));

    useEffect(() => {

        lastValueFrom(download$).then(() => {
            notification.notifySystem({ title: "OneClick", body: t("notifications.playlists.one-click-install.success") });
        }).catch(() => {
            notification.notifySystem({ title: t("notifications.types.error"), body: t("notifications.playlists.one-click-install.error") });
        }).finally(() => {
            closeWindow();
        });

    }, []);

    useOnUpdate(() => {
        setTimeout(() => {
            mapsContainer.current.scrollTo({ left: mapsContainer.current.scrollWidth, behavior: "smooth",});
        }, 500);
    }, [downloadedMaps]);

    const playlistImage = () => {
        if(!playlistInfos?.image) return defaultImage;
        if (playlistInfos?.image.startsWith("data:image")) {
            return playlistInfos?.image;
        }
        return `data:image/png;base64,${playlistInfos?.image}`;
    }

    return (
        <div className="relative w-screen h-screen overflow-hidden">
            {playlistInfos && <BsmImage className="absolute top-0 left-0 w-full h-full" placeholder={defaultImage} image={playlistImage()} errorImage={defaultImage} />}
            <div className="w-full h-full backdrop-brightness-50 backdrop-blur-md flex flex-col justify-start items-center">
                <TitleBar template="oneclick-download-playlist.html" />
                <BsmImage className="mt-2 aspect-square w-1/2 object-cover rounded-md shadow-black shadow-lg" placeholder={defaultImage} image={playlistImage()} errorImage={defaultImage} />
                <h1 className="mt-4 overflow-hidden font-bold italic text-xl text-gray-200 tracking-wide w-full text-center whitespace-nowrap text-ellipsis px-2">{playlistInfos?.playlistTitle}</h1>
                <div className="w-full py-3 flex items-center justify-center max-w-full overflow-x-scroll overflow-y-hidden scrollbar scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-900" ref={mapsContainer}>
                    <div className="flex justify-start items-start gap-2.5">{downloadedMaps?.map(map => map?.coverUrl &&
                        <motion.img layout="position" key={map.hash} className="block aspect-square w-14 object-cover rounded-md shadow-black shadow-md" src={map?.coverUrl} initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ rotate: 5 }} />
                    )}</div>
                </div>
            </div>
            <BsmProgressBar />
        </div>
    );
}
