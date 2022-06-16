import { BSVersion } from '../../main/services/bs-version-manager.service';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import BSLogo from '../../../assets/bs-logo.png';
import { BSLauncherService, LaunchMods, LaunchResult } from '../services/bs-launcher.service';
import { TabNavBar } from 'renderer/components/shared/tab-nav-bar.component';
import wipGif from "../../../assets/wip.gif"
import { ConfigurationService } from 'renderer/services/configuration.service';

export function VersionViewer() {

  const {state} = useLocation() as {state: BSVersion};
  //const bsLauncherService = BSLauncherService.getInstance();

  const [oculusMode, setOculusMode] = useState(false);
  const [desktopMode, setDesktopMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [currentTabIndex, setCurrentTabIndex] = useState(0);

  const configService = ConfigurationService.getInstance();

  // const [launchRes, setLaunchRes] = useState(null);

  useEffect(() => {
    setOculusMode(!!configService.get<boolean>(LaunchMods.OCULUS_MOD));
    setDesktopMode(!!configService.get<boolean>(LaunchMods.DESKTOP_MOD));
    setDebugMode(!!configService.get<boolean>(LaunchMods.DEBUG_MOD));
  }, [])
  

  const setMode = (mode: LaunchMods, value: boolean) => {
    if(mode === LaunchMods.DEBUG_MOD){ setDebugMode(value); }
    else if(mode === LaunchMods.OCULUS_MOD){ 
      setOculusMode(value); 
      setDesktopMode(false);
      configService.set(LaunchMods.DESKTOP_MOD, false);
    }
    else if(mode === LaunchMods.DESKTOP_MOD){ 
      setDesktopMode(value); 
      setOculusMode(false);
      configService.set(LaunchMods.OCULUS_MOD, false);
    }
    configService.set(mode, value);
  }

  // const launchBs = () => {
  //   bsLauncherService.launch(state, oculusMode, desktopMode, debugMode).then(res => setLaunchRes(res));
  // }

  return (
    <>
      <img className="absolute w-full h-full top-0 left-0 blur-lg object-cover brightness-90" src={state.ReleaseImg} alt="" />
      <div className="relative flex items-center flex-col w-full h-full text-gray-200">
        <img className='relative object-cover h-28' src={BSLogo} alt="" />
        <h1 className='relative text-4xl font-bold italic -top-3'>{state.BSVersion}</h1>
        <TabNavBar className='mt-3' tabsText={["Launch", "Maps", "Mods"]} onTabChange={(i : number) => setCurrentTabIndex(i)}/>
        <div className='mt-2 w-full grow flex transition-transform duration-300 pt-5' style={{transform: `translate(${-(currentTabIndex * 100)}%, 0)`}}>
          <div className='w-full shrink-0 items-start relative flex flex-row justify-center -top-2'>
            <ToogleLunchMod onClick={() => setMode(LaunchMods.OCULUS_MOD, !oculusMode)} active={oculusMode} text="OCULUS MOD"/>
            <ToogleLunchMod onClick={() => setMode(LaunchMods.DESKTOP_MOD, !desktopMode)} active={desktopMode} text="DESKTOP MOD"/>
            <ToogleLunchMod onClick={() => setMode(LaunchMods.DEBUG_MOD, !debugMode)} active={debugMode} text="DEBUG MOD"/>
          </div>
          <div className='shrink-0 w-full h-full flex justify-center'>
            <div className='p-4 bg-main-color-2 h-fit rounded-md'>
              <img src={wipGif} alt="" />
              <span className='block w-full text-center font-bold mt-2'>Work In Progress</span>
            </div>
          </div>
          <div className='shrink-0 w-full h-full flex justify-center'>
            <div className='p-4 bg-main-color-2 h-fit rounded-md'>
              <img src={wipGif} alt="" />
              <span className='block w-full text-center font-bold mt-2'>Work In Progress</span>
            </div>
          </div>
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
