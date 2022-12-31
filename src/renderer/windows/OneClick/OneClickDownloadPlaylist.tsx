import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react"
import { BsmProgressBar } from "renderer/components/progress-bar/bsm-progress-bar.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import TitleBar from "renderer/components/title-bar/title-bar.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { IpcService } from "renderer/services/ipc.service"
import { NotificationService } from "renderer/services/notification.service";
import { PlaylistDownloaderService } from "renderer/services/playlist-downloader.service";
import { ThemeService } from "renderer/services/theme.service";
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service";
import { WindowManagerService } from "renderer/services/window-manager.service";
import { map, filter } from "rxjs/operators";
import { BsvPlaylist } from "shared/models/maps/beat-saver.model";
import defaultImage from '../../../../assets/images/default-version-img.jpg';

export default function OneClickDownloadPlaylist() {

    const ipc = IpcService.getInstance();
    const bSaver = BeatSaverService.getInstance();
    const themeService = ThemeService.getInstance();
    const playlistDownloader = PlaylistDownloaderService.getInstance();
    const mapsContainer = useRef<HTMLDivElement>(null);
    const windows = WindowManagerService.getInstance();
    const notification = NotificationService.getInstance();

    const [playlist, setPlaylist] = useState<BsvPlaylist>(null);
    const downloadedMap = useObservable(playlistDownloader.progress$.pipe(filter(download => !!download), map(download => [...(download.downloadedMaps ?? []), download?.current])), []);
    const t = useTranslation();

    const cover = playlist ? playlist.playlistImage : null;
    const title = playlist ? playlist.name : null;

    useEffect(() => {

        const sub = themeService.theme$.subscribe(() => {
            if(themeService.isDark || (themeService.isOS && window.matchMedia('(prefers-color-scheme: dark)').matches)){ document.documentElement.classList.add('dark'); }
            else { document.documentElement.classList.remove('dark'); }
        });

        const promise = new Promise(async (resolve, reject) => {

            const infos = await ipc.send<{bpListUrl: string, id: string}>("one-click-playlist-info");

            if(!infos.success){ return reject(infos.error); }

            bSaver.getPlaylistDetailsById(infos.data.id).then(details => setPlaylist(details));

            playlistDownloader.oneClickInstallPlaylist(infos.data.bpListUrl).toPromise().then(res => {
                resolve(res);
            }).catch(() => {
                reject();
            });

        });

        promise.catch(() => {
            notification.notifySystem({title: t("notifications.types.error"), body: t("notifications.playlists.one-click-install.error")});
        })

        promise.then(() => {
            notification.notifySystem({title: "OneClick", body: t("notifications.playlists.one-click-install.success")});
        });

        promise.finally(() => {
            windows.close("oneclick-download-playlist.html");
        });

        return () => {
            sub.unsubscribe();
        }
    
    }, []);

    useEffect(() => {
        setTimeout(() => mapsContainer.current.scrollTo({
            left: mapsContainer.current.scrollWidth,
            behavior: "smooth"
        }), 500);
    }, [downloadedMap])
    
    

    return (
        <div className="relative w-screen h-screen overflow-hidden">
            {playlist && <BsmImage className="absolute top-0 left-0 w-full h-full" image={playlist.playlistImage}/>}
            <div className="w-full h-full backdrop-brightness-50 backdrop-blur-md flex flex-col justify-start items-center">
                <TitleBar template="oneclick-download-playlist.html"/>
                <BsmImage className="mt-2 aspect-square w-1/2 object-cover rounded-md shadow-black shadow-lg" placeholder={defaultImage} image={cover} errorImage={defaultImage}/>
                <h1 className="mt-4 overflow-hidden font-bold italic text-xl text-gray-200 tracking-wide w-full text-center whitespace-nowrap text-ellipsis px-2">{title}</h1>
                <div className="w-full py-3 flex items-center justify-center max-w-full overflow-x-scroll overflow-y-hidden scrollbar scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-900" ref={mapsContainer}>
                    <div className="flex justify-start items-start gap-2.5">
                        {downloadedMap?.map(map => (
                            map?.versions?.at(0)?.coverURL && <motion.img layout="position" key={map.id} className="block aspect-square w-14 object-cover rounded-md shadow-black shadow-md" src={map?.versions?.at(0)?.coverURL} initial={{scale: 0}} animate={{scale: 1}} whileHover={{rotate: 5}}/>
                        ))}
                    </div>
                </div>    
            </div>
            <BsmProgressBar/>
        </div>
    )
}
