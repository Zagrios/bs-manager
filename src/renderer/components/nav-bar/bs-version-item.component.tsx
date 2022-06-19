import { BSVersion } from "main/services/bs-version-manager.service";
import { Link, useLocation } from "react-router-dom";
import { BsNoteFill } from "../svgs/bs-note-fill.component";
import { SteamIcon } from "../svgs/steam-icon.component";
import { BsDownloaderService } from "renderer/services/bs-downloader.service";
import { useEffect, useState } from "react";
import { combineLatest } from "rxjs";

export default function BsVersionItem(props: {version: BSVersion}) {

  const { state } = useLocation() as { state: BSVersion};

  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);

  const downloaderService = BsDownloaderService.getInstance();

  const isActive = (): boolean => {
    return props.version?.BSVersion === state?.BSVersion && props?.version.steam === state?.steam;
  }

  useEffect(() => {
    combineLatest([downloaderService.currentBsVersionDownload$, downloaderService.downloadProgress$]).subscribe(vals => {
      if(vals[0]?.BSVersion === props.version.BSVersion && vals[0]?.steam === props.version.steam){
        setDownloading(true);
        setDownloadPercent(vals[1]);
      }
      else{
        setDownloading(false);
        setDownloadPercent(0);
      }
    })
  }, [])


  return (
    <div className={`outline-none relative p-[1px] overflow-hidden rounded-full flex justify-center content-center items-center mb-1 ${downloading && "nav-item-download"}`}>
      <div className="absolute top-0 w-full h-full" style={{transform: `translate(${-(100 - downloadPercent)}%, 0)`}}></div>
      <Link to={`/bs-version/${props.version.BSVersion}`} state={props.version} className={`z-[1] flex cursor-pointer w-full justify-center content-center rounded-full items-center p-[3px] pl-2 pr-2 hover:bg-main-color-3 ${downloading && 'bg-black'} ${(isActive() && !downloading) && "bg-main-color-3"}`}>
        {props.version.steam && <SteamIcon className="w-[19px] h-[19px] mr-1"/>}
        {!props.version.steam && <BsNoteFill className="w-[19px] h-[19px] mr-1 text-red-600"/>}
        <span className="flex items-center justify-center content-center shrink-0 grow text-lg text-gray-200 font-bold min-w-0 tracking-wide">{props.version.BSVersion}</span>
      </Link>
    </div>

  )
}
