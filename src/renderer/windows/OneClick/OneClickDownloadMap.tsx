import { useEffect, useState } from "react";
import { BsmProgressBar } from "renderer/components/progress-bar/bsm-progress-bar.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import TitleBar from "renderer/components/title-bar/title-bar.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { IpcService } from "renderer/services/ipc.service";
import { MapsDownloaderService } from "renderer/services/maps-downloader.service";
import { NotificationService } from "renderer/services/notification.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { ThemeService } from "renderer/services/theme.service";
import { BeatSaverService } from "renderer/services/thrird-partys/beat-saver.service";
import { WindowManagerService } from "renderer/services/window-manager.service";
import { timer } from "rxjs";
import { BsvMapDetail } from "shared/models/maps";
import defaultImage from '../../../../assets/images/default-version-img.jpg'

export default function OneClickDownloadMap() {

    const ipc = IpcService.getInstance();
    const bsv = BeatSaverService.getInstance();
    const mapsDownloader = MapsDownloaderService.getInstance();
    const themeService = ThemeService.getInstance();
    const progressBar = ProgressBarService.getInstance();
    const windows = WindowManagerService.getInstance();
    const notification = NotificationService.getInstance();

    const [mapInfo, setMapInfo] = useState<BsvMapDetail>(null);
    const t = useTranslation();

    const cover = mapInfo ? mapInfo.versions.at(0).coverURL : null;
    const title = mapInfo ? mapInfo.name : null;

    useEffect(() => {

        const sub = themeService.theme$.subscribe(() => {
            if(themeService.isDark || (themeService.isOS && window.matchMedia('(prefers-color-scheme: dark)').matches)){ document.documentElement.classList.add('dark'); }
            else { document.documentElement.classList.remove('dark'); }
        });

        progressBar.open();

        const promise = new Promise<void>(async (resolve, reject) => {

            try{

                const ipcRes = await ipc.send<{id: string, isHash: boolean}>("one-click-map-info");

                if(!ipcRes.success){ return reject(ipcRes.error); }

                const mapDetails = ipcRes.data.isHash ? (await bsv.getMapDetailsFromHashs([ipcRes.data.id])).at(0) : await bsv.getMapDetailsById(ipcRes.data.id);
                
                setMapInfo(() => mapDetails);
                
                const res = await mapsDownloader.oneClickInstallMap(mapDetails);

                progressBar.complete();

                if(!res){ return reject(); }

                await timer(300).toPromise();

                resolve();
            }
            catch(e){
                reject(e);
            }
            
        });

        promise.catch(() => {
            notification.notifySystem({title: t("notifications.types.error"), body: t("notifications.maps.one-click-install.error")});
        });

        promise.then(() => {
            notification.notifySystem({title: "OneClick", body: t("notifications.maps.one-click-install.success")});
        });

        promise.finally(() =>{
            windows.close("oneclick-download-map.html");
        });

        return () => {
            sub.unsubscribe();
        }

    }, []);

    return (
        <div className="relative w-screen h-screen overflow-hidden">
            {cover && <BsmImage className="absolute top-0 left-0 w-full h-full object-cover" image={cover}/>}
            <div className="w-full h-full backdrop-brightness-50 backdrop-blur-md flex flex-col justify-start items-center gap-10">
                <TitleBar template="oneclick-download-map.html"/>
                <BsmImage className="aspect-square w-1/2 object-cover rounded-md shadow-black shadow-lg" placeholder={defaultImage} image={cover} errorImage={defaultImage}/>
                <h1 className="overflow-hidden font-bold italic text-xl text-gray-200 tracking-wide w-full text-center whitespace-nowrap text-ellipsis px-2">{title}</h1>
            </div>
            <BsmProgressBar/>
        </div>
        
    )
}
