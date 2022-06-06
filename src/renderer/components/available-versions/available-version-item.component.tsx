import { BSVersion } from "main/services/bs-version-manager.service";
import './available-version-item.component.css';
import { SteamIcon } from "../svgs/steam-icon.component";
import { useEffect, useState } from "react";
import { BsDownloaderService } from "renderer/services/bs-downloader.service";
import { distinctUntilChanged, distinctUntilKeyChanged } from "rxjs";

export function AvailableVersionItem(props: {version: BSVersion}) {

  const bsDownloaderService = BsDownloaderService.getInstance();

  const [selected, setSelected] = useState(false);

  const onClickAction = () => {
    if(selected){
      bsDownloaderService.selectedBsVersion$.next(null);
    }
    else{
      bsDownloaderService.selectedBsVersion$.next(props.version);
    }
  }

  useEffect(() => {
    const sub = bsDownloaderService.selectedBsVersion$.pipe(distinctUntilChanged()).subscribe((version) => {
      setSelected(version?.BSVersion === props.version.BSVersion)
    });
  
    return () => {
      sub.unsubscribe();
    }
  }, [])

  return (
    <div className="group m-3 relative w-72 h-60" onClick={onClickAction}>
      <div className={`absolute glow-on-hover group-hover:opacity-100 ${selected && "opacity-100"}`}></div>
      <div className={`relative flex flex-col overflow-hidden rounded-md w-72 h-60 bg-main-color-2 cursor-pointer group-hover:shadow-none duration-300 ${!selected && "shadow-lg shadow-gray-900"}`}>
        <img src="https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/clans/32055887/d854a4cc83b282acc191227a7759b4f5e6c6b085.png" className="absolute top-0 right-0 w-full h-full opacity-40 blur-xl object-cover"></img>
        <img src="https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/clans/32055887/d854a4cc83b282acc191227a7759b4f5e6c6b085.png" className="bg-black w-full h-3/4 object-cover"/>
        <div className="relative z-[1] p-2 w-full flex items-center justify-between grow">
          <div>
            <span className="block text-xl font-bold text-white tracking-wider">{props.version.BSVersion}</span>
            <span className="text-sm text-gray-400">jeu. 19 mai 2022</span>
          </div>
          <a href={props.version.ReleaseURL} target="_blank" rel="noreferrer" className="relative z-10 flex flex-row justify-between items-center rounded-full bg-black bg-opacity-30 text-white pb-[1px] hover:bg-opacity-50">
            <SteamIcon className="w-[25px] h-[25px] transition-transform group-hover:rotate-[-360deg] duration-300"/>
            <span className="relative -left-[2px] text-sm w-0 text-center overflow-hidden h-full whitespace-nowrap pb-[3px] transition-all group-hover:w-24 duration-300">Release Page</span>
          </a>
        </div>
      </div>
    </div>
  )
}
