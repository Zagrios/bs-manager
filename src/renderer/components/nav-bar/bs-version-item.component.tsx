import { BSVersion } from 'shared/bs-version.interface';
import { Link, useLocation } from "react-router-dom";
import { BsDownloaderService } from "renderer/services/bs-downloader.service";
import { useEffect, useState } from "react";
import { combineLatest, Subscription } from "rxjs";
import { BSLauncherService, LaunchMods } from "renderer/services/bs-launcher.service";
import { ConfigurationService } from "renderer/services/configuration.service";
import { BsmButton } from "../shared/bsm-button.component";
import { BSUninstallerService } from "renderer/services/bs-uninstaller.service";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { ReactFitty } from "react-fitty";
import { DefaultConfigKey } from 'renderer/config/default-configuration.config';

export function BsVersionItem(props: {version: BSVersion}) {

  const downloaderService = BsDownloaderService.getInstance();
  const verionManagerService = BSVersionManagerService.getInstance();
  const launcherService = BSLauncherService.getInstance();
  const configService = ConfigurationService.getInstance();
  const bsUninstallerService = BSUninstallerService.getInstance();

  const { state } = useLocation() as { state: BSVersion};

  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [color, setColor] = useState("");

  const isActive = (): boolean => {
    return props.version?.BSVersion === state?.BSVersion && props?.version.steam === state?.steam && props?.version.name === state?.name;
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
      const subs: Subscription[] = [];
      const downloadSub = combineLatest([downloaderService.currentBsVersionDownload$, downloaderService.downloadProgress$]).subscribe(vals => {
         if(vals[0]?.BSVersion === props.version.BSVersion && vals[0]?.steam === props.version.steam && vals[0]?.name === props.version.name){
         setDownloading(true);
         setDownloadPercent(vals[1]);
         }
         else{
            setDownloading(false);
            setDownloadPercent(0);
         }
      });
      subs.push(downloadSub);
      if(props.version?.color){ setColor(props.version.color); }
      else{
         const colorSub = configService.watch<string>("second-color" as DefaultConfigKey).subscribe(color => setColor(color));
         subs.push(colorSub);
      }

      return () => { subs.forEach(s => s.unsubscribe()); }
  }, []);


  return (
    <div className={`outline-none relative p-[1px] overflow-hidden rounded-xl flex justify-center items-center mb-1 ${downloading && "nav-item-download"} active:translate-y-[1px]`}>
      <div className="progress absolute top-0 w-full h-full" style={{transform: `translate(${-(100 - downloadPercent)}%, 0)`}}></div>
      <div className={`wrapper z-[1] px-1 py-[3px] w-full rounded-xl ${downloading && 'bg-black'} ${!downloading && "hover:bg-light-main-color-3 dark:hover:bg-main-color-3"} ${(isActive() && !downloading) && "bg-light-main-color-3 dark:bg-main-color-3"}`}>
         <Link onDoubleClick={handleDoubleClick} to={`/bs-version/${props.version.BSVersion}`} state={props.version} title={props.version.name && `${props.version.BSVersion} - ${props.version.name}`} className="w-full flex items-center justify-start content-center max-w-full">
            {props.version.steam && <BsmIcon icon="steam" className="w-[19px] h-[19px] mr-[5px] shrink-0"/>}
            {!props.version.steam && <BsmIcon icon="bsNote" className="w-[19px] h-[19px] mr-[5px] shrink-0" style={{color: color}}/>}
            <div className="overflow-hidden whitespace-nowrap text-xl dark:text-gray-200 text-gray-800 font-bold tracking-wide">
               <ReactFitty maxSize={19} minSize={10} className='align-middle pb-[2px] max-w-full overflow-hidden text-ellipsis'>{props.version.name || props.version.BSVersion}</ReactFitty>
            </div>
         </Link>
         {downloading && <BsmButton onClick={cancel} className="my-1 text-xs text-white rounded-md text-center hover:brightness-125" withBar={false} text="misc.cancel" typeColor="error"/>}
      </div>
    </div>

  )
}