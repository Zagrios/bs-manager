import { BSVersion } from '../../main/services/bs-version-manager.service';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BsDownloaderService } from '../services/bs-downloader.service';
import { Subscription } from 'rxjs';
import BSLogo from '../../../assets/bs-logo.png';
import { BSLauncherService, LaunchResult } from '../services/bs-launcher.service';
import { TabNavBar } from 'renderer/components/shared/tab-nav-bar.component';

export function VersionViewer() {

  const {state} = useLocation() as {state: BSVersion};

  const bsDownloaderService = BsDownloaderService.getInstance();
  const bsLauncherService = BSLauncherService.getInstance();

  const [oculusMode, setOculusMode] = useState(false);
  const [desktopMode, setDesktopMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const [subs, setSubs] = useState([] as Subscription[]);

  const [launchRes, setLaunchRes] = useState(null);

  useEffect(() => {
    const downloadingSub = bsDownloaderService.currentBsVersionDownload$.subscribe(version => {
      if(!version){ setDownloading(false); return }
      if(state.BSVersion === version.BSVersion){ setDownloading(true); return }
      setDownloading(false);
    });
    setSubs([...subs, downloadingSub]);

    return () => {
      subs.forEach(s => s.unsubscribe());
      setOculusMode(false); setDebugMode(false); setDesktopMode(false);
      setDownloading(false);
      setLaunchRes(null);
    }
  }, [state]);

  useEffect(() => {
    if(!downloading){ return; }
    const progressSub = bsDownloaderService.downloadProgress$.subscribe(progress => {
      if(downloading){ setDownloadProgress(progress); }
    });
    setSubs([...subs, progressSub]);
  }, [downloading])




  const setMode = (mode: string, value: boolean) => {
    if(mode === "debug"){ setDebugMode(value); }
    if(mode === "oculus"){ setOculusMode(value); setDesktopMode(false); }
    if(mode === "desktop"){ setDesktopMode(value); setOculusMode(false); }
  }

  const launchBs = () => {
    bsLauncherService.launch(state, oculusMode, desktopMode, debugMode).then(res => setLaunchRes(res));
  }

  return (
    <>
      <img className="absolute w-full h-full top-0 left-0 blur-lg object-cover brightness-90" src={state.ReleaseImg} alt="" />
      <div className="relative flex items-center flex-col w-full h-full text-gray-200">
        <img className='relative -left-4 object-cover h-28' src={BSLogo} alt="" />
        <h1 className='relative text-4xl font-bold italic -top-4'>{state.BSVersion}</h1>
        <TabNavBar tabsText={["Launch", "Maps", "Mods"]} onTabChange={() => console.log()}/>
        <div className='relative flex flex-row justify-center items-center content-center -top-2'>
          <ToogleLunchMod onClick={() => setMode("oculus", !oculusMode)} active={oculusMode} text="OCULUS MOD"/>
          <ToogleLunchMod onClick={() => setMode("desktop", !desktopMode)} active={desktopMode} text="DESKTOP MOD"/>
          <ToogleLunchMod onClick={() => setMode("debug", !debugMode)} active={debugMode} text="DEBUG MOD"/>
        </div>
      </div>
    </>
  )
}

export function ToogleLunchMod(props: {onClick: Function, active: boolean, text: string}) {
  return (
    <span onClick={() => props.onClick()} className={`w-56 text-center cursor-pointer p-3 border-4 border-white rounded-full font-bold italic text-lg tracking-wide ml-3 mr-3 transition-all ${props.active && "bg-white text-black bg-opacity-70"} hover:bg-white hover:bg-opacity-70 hover:text-black`}>{props.text}</span>
  );
}
