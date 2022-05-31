import { BSVersion } from '../../main/services/bs-version-manager.service';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BsDownloaderService } from '../services/bs-downloader.service';
import { Subscription } from 'rxjs';
import BSLogo from '../../../assets/bs-logo.png';
import BeatRunning from '../../../assets/beat-running.png';
import { BSLauncherService, LaunchResult } from '../services/bs-launcher.service';

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
    <div className="flex items-center flex-col w-full text-gray-200">
      <div className='w-fit flex flex-col items-center'>
        <img className='max-w-xl' src={BSLogo} alt="" />
        <h1 className='text-4xl font-bold'>{state.BSVersion}</h1>
        { launchRes === LaunchResult.STEAM_NOT_RUNNING && <h2 className='text-3xl font-bold text-red-600'>STEAM NOT RUNNING</h2>}
        { launchRes === LaunchResult.EXE_NOT_FIND && <h2 className='text-3xl font-bold text-red-600'>EXECUTABLE NOT EXIST</h2>}
        <div className='flex justify-around w-3/4 mt-5'>
          <div>
            <input onChange={e => setMode("debug", e.target.checked)} checked={debugMode} type="checkbox" name="debug-mode" id="debug-mode" />
            <label htmlFor="debug-mode">DEBUG MODE</label>
          </div>
          <div>
            <input onChange={e => setMode("oculus", e.target.checked)} checked={oculusMode} type="checkbox" name="oculus-mode" id="oculus-mode" />
            <label htmlFor="oculus-mode">OCULUS MODE</label>
          </div>
          <div>
            <input onChange={e => setMode("desktop", e.target.checked)} checked={desktopMode} type="checkbox" name="decktop-mode" id="decktop-mode" />
            <label htmlFor="decktop-mode">DESKTOP MODE</label>
          </div>
        </div>
        {downloading &&
          <div className='relative flex flex-col items-center justify-center content-center w-full mt-7 mb-7'>
            <img className='absolute z-[1] h-16 top-[-34px] transition-all' style={{left: `calc(${downloadProgress}% - 34px)`}} src={BeatRunning} alt="" />
            <div className='w-full h-2 relative overflow-hidden bg-main-color-1 rounded-full'>
              <div className='download-progress w-full h-full overflow-hidden transition-transform' style={{transform: `translate(${downloadProgress - 100}%, 0)`}}></div>
            </div>
            <span>{`${downloadProgress}%`}</span>
          </div>
        }
        { !downloading && <button className='mt-5 text-2xl font-bold bg-gray-200 text-gray-900' onClick={launchBs}>Launch</button> }
      </div>
    </div>
  )
}
