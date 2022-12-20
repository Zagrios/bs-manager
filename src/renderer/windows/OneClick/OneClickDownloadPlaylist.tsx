import { useEffect, useState } from "react"
import { BsmProgressBar } from "renderer/components/progress-bar/bsm-progress-bar.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import TitleBar from "renderer/components/title-bar/title-bar.component";
import { IpcService } from "renderer/services/ipc.service"
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { ThemeService } from "renderer/services/theme.service";
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service";
import { BsvPlaylist } from "shared/models/maps/beat-saver.model";
import defaultImage from '../../../../assets/images/default-version-img.jpg';

export default function OneClickDownloadPlaylist() {

    const ipc = IpcService.getInstance();
    const bSaver = BeatSaverService.getInstance();
    const progress = ProgressBarService.getInstance();
    const themeService = ThemeService.getInstance();

    const [playlist, setPlaylist] = useState<BsvPlaylist>(null);

    const cover = playlist ? playlist.playlistImage : null;
    const title = playlist ? playlist.name : null

    useEffect(() => {

        const sub = themeService.theme$.subscribe(() => {
            if(themeService.isDark || (themeService.isOS && window.matchMedia('(prefers-color-scheme: dark)').matches)){ document.documentElement.classList.add('dark'); }
            else { document.documentElement.classList.remove('dark'); }
        });

        progress.open();
      
        ipc.send<{bpListUrl: string, id: string}>("one-click-playlist-info").then(res => {

            console.log(res);
            
            const playlistId = res.data.id;
            const downloadUrl = res.data.bpListUrl;

            bSaver.getPlaylistDetailsById(playlistId).then(playlist => setPlaylist(() => playlist));

        });
    
    }, []);
    

    return (
        <div className="relative w-screen h-screen overflow-hidden">
            {playlist && <BsmImage className="absolute top-0 left-0 w-full h-full" image={playlist.playlistImage}/>}
            <div className="w-full h-full backdrop-brightness-50 backdrop-blur-md flex flex-col justify-start items-center gap-10">
                <TitleBar template="oneclick-download-map.html"/>
                <BsmImage className="aspect-square w-1/2 object-cover rounded-md shadow-black shadow-lg" placeholder={defaultImage} image={cover} errorImage={defaultImage}/>
                <h1 className="overflow-hidden font-bold italic text-xl text-gray-200 tracking-wide w-full text-center whitespace-nowrap text-ellipsis px-2">{title}</h1>
            </div>
            <BsmProgressBar/>
        </div>
    )
}
