import { useEffect, useState } from "react";
import { BsmProgressBar } from "renderer/components/progress-bar/bsm-progress-bar.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import TitleBar from "renderer/components/title-bar/title-bar.component";
import { IpcService } from "renderer/services/ipc.service";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { ThemeService } from "renderer/services/theme.service";
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service";
import { BsvMapDetail } from "shared/models/maps";
import defaultImage from '../../../../assets/images/default-version-img.jpg'

export default function OneClickDownloadMap() {

    const ipc = IpcService.getInstance();
    const bsv = BeatSaverService.getInstance();
    const mapsDownloader = MapsDownloaderService.getInstance();
    const themeService = ThemeService.getInstance();
    const progressBar = ProgressBarService.getInstance();

    const [mapInfo, setMapInfo] = useState<BsvMapDetail>(null);

    const cover = mapInfo ? mapInfo.versions.at(0).coverURL : null;

    useEffect(() => {

        const sub = themeService.theme$.subscribe(() => {
            if(themeService.isDark || (themeService.isOS && window.matchMedia('(prefers-color-scheme: dark)').matches)){ document.documentElement.classList.add('dark'); }
            else { document.documentElement.classList.remove('dark'); }
        });

        progressBar.open();
      
        ipc.send<{id: string, isHash: boolean}>("one-click-map-info").then(res => {

            console.log(res);
        
            if(res.data.isHash){
                return bsv.getMapDetailsFromHashs([res.data.id]).then(res => setMapInfo(() => res.at(0)));
            }
    
            bsv.getMapDetailsById(res.data.id).then(async map => {
                
                setMapInfo(() => map);

                mapsDownloader.oneClickInstallMap(map).finally(() => ipc.sendLazy('window.close'));

            });
    
        });

        return () => {
            sub.unsubscribe();
        }

    }, [])
    

    console.log(mapInfo);

    return (
        <div className="relative w-screen h-screen overflow-hidden">
            <div className="w-full h-full absolute top-0 left-0">
                <BsmImage className="absolute top-0 left-0 w-full h-full object-cover bg-center" placeholder={defaultImage} image={cover}/>
            </div>
            <div className="w-full h-full absolute top-0 left-0 backdrop-blur-md backdrop-brightness-50 flex flex-col justify-start items-center gap-10">
                <TitleBar template="oneclick"/>
                <BsmImage className="aspect-square w-1/2 object-cover rounded-md bg-center shadow-black shadow-lg" placeholder={defaultImage} image={cover}/>
                <h1 className="font-bold italic text-xl text-gray-200 tracking-wide">{mapInfo?.name ?? "Chargement de la map..."}</h1>
            </div>
            <BsmProgressBar/>
        </div>
        
    )
}
