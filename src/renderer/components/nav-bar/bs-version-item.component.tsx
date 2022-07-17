import { BSVersion } from "main/services/bs-version-manager.service";
import { Link, useLocation } from "react-router-dom";
import { BsDownloaderService } from "renderer/services/bs-downloader.service";
import { useEffect, useState } from "react";
import { combineLatest } from "rxjs";
import { BSLauncherService, LaunchMods } from "renderer/services/bs-launcher.service";
import { ConfigurationService } from "renderer/services/configuration.service";
import { BsmButton } from "../shared/bsm-button.component";
import { BSUninstallerService } from "renderer/services/bs-uninstaller.service";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { BsmIcon } from "../svgs/bsm-icon.component";

export function BsVersionItem(props: {version: BSVersion}) {

  const { state } = useLocation() as { state: BSVersion};

  const [downloading, setDownloading] = useState(true);
  const [downloadPercent, setDownloadPercent] = useState(0);

  const downloaderService = BsDownloaderService.getInstance();
  const verionManagerService = BSVersionManagerService.getInstance();
  const launcherService = BSLauncherService.getInstance();
  const configService = ConfigurationService.getInstance();
  const bsUninstallerService = BSUninstallerService.getInstance();

  const isActive = (): boolean => {
    return props.version?.BSVersion === state?.BSVersion && props?.version.steam === state?.steam;
  }

   const handleDoubleClick = () => {
      launcherService.launch(
         state,
         !!configService.get<boolean>(LaunchMods.OCULUS_MOD),
         !!configService.get<boolean>(LaunchMods.DESKTOP_MOD),
         !!configService.get<boolean>(LaunchMods.DEBUG_MOD)
      )
   }

   const cancel = () => {
      const versionDownload = downloaderService.currentBsVersionDownload$.value;
      downloaderService.cancelDownload().then(async res => {
         if(!res.success){ return; }
         if(!downloaderService.isVerification){
            bsUninstallerService.uninstall(versionDownload).then(res => res && verionManagerService.askInstalledVersions());
         }
      });
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
  }, []);


  return (
    <div className={`outline-none relative p-[1px] overflow-hidden rounded-xl flex justify-center content-center items-center mb-1 ${downloading && "nav-item-download"} active:translate-y-[1px]`}>
      <div className="progress absolute top-0 w-full h-full" style={{transform: `translate(${-(100 - downloadPercent)}%, 0)`}}></div>
      <div className={`wrapper z-[1] px-2 py-[3px] w-full rounded-xl ${downloading && 'bg-black'} ${!downloading && "hover:bg-light-main-color-3 dark:hover:bg-main-color-3"} ${(isActive() && !downloading) && "bg-light-main-color-3 dark:bg-main-color-3"}`}>
         <Link onDoubleClick={handleDoubleClick} to={`/bs-version/${props.version.BSVersion}`} state={props.version} className="flex justify-center items-center">
            {props.version.steam && <BsmIcon icon="steam" className="w-[19px] h-[19px] mr-1"/>}
            {!props.version.steam && <BsmIcon icon="bsNote" className="w-[19px] h-[19px] mr-1 text-red-600"/>}
            <span className="flex items-center justify-center content-center shrink-0 grow text-lg dark:text-gray-200 text-gray-800 font-bold min-w-0 tracking-wide">{props.version.BSVersion}</span>
         </Link>
         {downloading && <BsmButton onClick={cancel} className="my-1 text-xs text-white rounded-md text-center hover:brightness-125" withBar={false} text="misc.cancel" typeColor="error"/>}
      </div>
    </div>

  )
}