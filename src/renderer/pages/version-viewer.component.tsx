import { BSVersion } from '../../main/services/bs-version-manager.service';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BSLogo from '../../../assets/bs-logo.png';
import { BSLauncherService, LaunchMods, LaunchResult } from '../services/bs-launcher.service';
import { TabNavBar } from 'renderer/components/shared/tab-nav-bar.component';
import wipGif from "../../../assets/wip.gif"
import { ConfigurationService } from 'renderer/services/configuration.service';
import { BsmDropdownButton } from 'renderer/components/shared/bsm-dropdown-button.component';
import { BsmIcon, BsmIconType } from 'renderer/components/svgs/bsm-icon.component';
import { BsmImage } from 'renderer/components/shared/bsm-image.component';
import defaultImageVersion from "../../../assets/default-version-img.jpg"
import { BsmButton } from 'renderer/components/shared/bsm-button.component';
import BeatRunning from "../../../assets/beat-running.png"
import { BSUninstallerService } from '../services/bs-uninstaller.service';
import { BSVersionManagerService } from '../services/bs-version-manager.service';
import { ModalExitCode, ModalService, ModalType } from '../services/modale.service';

export function VersionViewer() {

  const {state} = useLocation() as {state: BSVersion};
  const navigate = useNavigate();
  const bsLauncherService = BSLauncherService.getInstance();

  const [oculusMode, setOculusMode] = useState(false);
  const [desktopMode, setDesktopMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [currentTabIndex, setCurrentTabIndex] = useState(0);

  const configService = ConfigurationService.getInstance();
  const bsUninstallerService = BSUninstallerService.getInstance();
  const bsVersionManagerService = BSVersionManagerService.getInstance();
  const modalService = ModalService.getInsance();

  const [launchRes, setLaunchRes] = useState(null);

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

  const dropDownActions = async (id: number) => {
    if(id === 3){
      const modalCompleted = await modalService.openModal(ModalType.UNINSTALL, state)
      if(modalCompleted.exitCode === ModalExitCode.COMPLETED){
        bsUninstallerService.uninstall(state)
        .then(() => {
          bsVersionManagerService.askInstalledVersions();
          const newVersionPage = bsVersionManagerService.getInstalledVersions()[0];
          navigate("/bs-version/"+newVersionPage.BSVersion, {state: newVersionPage});
        })
        .catch((e) => {console.log("*** ", e)}) 
      }
    }
    else if(id === 2){
      window.electron.ipcRenderer.sendMessage("bs-version.open-folder", state);
    }
  }

  const launchBs = () => {
    bsLauncherService.launch(state, oculusMode, desktopMode, debugMode).then(res => {
      setLaunchRes(res);
    });
  }

  return (
    <>
      <BsmImage className="absolute w-full h-full top-0 left-0 blur-lg object-cover brightness-100" image={state.ReleaseImg} errorImage={defaultImageVersion}/>
      <div className="relative flex items-center flex-col w-full h-full text-gray-200">
        <BsmImage className='relative object-cover h-28' image={BSLogo}/>
        <h1 className='relative text-4xl font-bold italic -top-3'>{state.BSVersion}</h1>
        <TabNavBar className='mt-3' tabsText={["Launch", "Maps", "Mods"]} onTabChange={(i : number) => setCurrentTabIndex(i)}/>
        <div className='mt-2 w-full grow flex transition-transform duration-300 pt-5' style={{transform: `translate(${-(currentTabIndex * 100)}%, 0)`}}>
          <div className='w-full shrink-0 items-center relative flex flex-col justify-start -top-2'>
            <div className='grid grid-flow-col grid-cols-3 gap-6'>
              <ToogleLunchMod icon='oculus' onClick={() => setMode(LaunchMods.OCULUS_MOD, !oculusMode)} active={oculusMode} text="OCULUS MOD"/>
              <ToogleLunchMod icon='desktop' onClick={() => setMode(LaunchMods.DESKTOP_MOD, !desktopMode)} active={desktopMode} text="DESKTOP MOD"/>
              <ToogleLunchMod icon='terminal' onClick={() => setMode(LaunchMods.DEBUG_MOD, !debugMode)} active={debugMode} text="DEBUG MOD"/>
            </div>
            <div className='grow flex justify-center items-center'>
              <BsmButton onClick={launchBs} className='relative flex items-center text-5xl font-bold tracking-wide pt-1 pb-3 pl-7 pr-7 rounded-lg shadow-md italic shadow-black active:scale-90 transition-transform' text='Launch'/>
            </div>
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
      <BsmDropdownButton className='absolute top-5 right-5 h-9 w-9' onItemClick={dropDownActions} items={[
          {id: 1, text: "Add to favorites (wip)", icon:"favorite"},
          {id: 2, text: "Open folder", icon: "folder"},
          {id: 3, text: "Uninstall", icon:"trash"}
        ]}/>
    </>
  )
}

function ToogleLunchMod(props: {onClick: Function, active: boolean, text: string, icon: BsmIconType}) {
  return (
    <div className={`relative rounded-full cursor-pointer group active:scale-95 transition-transform ${!props.active && "shadow-md shadow-black"}`} onClick={() => props.onClick()}>
      <div className={`absolute glow-on-hover rounded-full ${props.active && "opacity-100 blur-[2px]"}`}></div>
      <div className='w-full h-full pl-6 pr-6 flex justify-center items-center bg-main-color-2 p-3 rounded-full text-white group-hover:bg-main-color-1'>
        <BsmIcon icon={props.icon} className='mr-1 h-7'/>
        <span className='w-fit min-w-fit h-full text-lg font-bold uppercase tracking-wide italic'>{props.text}</span>
      </div>
    </div>
  );
}
