import { BSVersion } from '../../main/services/bs-version-manager.service';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BSLogo from '../../../assets/images/apngs/bs-logo.png';
import { BSLauncherService, LaunchMods } from '../services/bs-launcher.service';
import { TabNavBar } from 'renderer/components/shared/tab-nav-bar.component';
import wipGif from "../../../assets/images/gifs/wip.gif"
import { ConfigurationService } from 'renderer/services/configuration.service';
import { BsmDropdownButton } from 'renderer/components/shared/bsm-dropdown-button.component';
import { BsmIcon, BsmIconType } from 'renderer/components/svgs/bsm-icon.component';
import { BsmImage } from 'renderer/components/shared/bsm-image.component';
import { BsmButton } from 'renderer/components/shared/bsm-button.component';
import { BSUninstallerService } from '../services/bs-uninstaller.service';
import { BSVersionManagerService } from '../services/bs-version-manager.service';
import { ModalExitCode, ModalService, ModalType } from '../services/modale.service';
import DefautVersionImage from "../../../assets/images/default-version-img.jpg";
import { NotificationService } from 'renderer/services/notification.service';
import { BsDownloaderService } from 'renderer/services/bs-downloader.service';
import { ProgressBarService } from 'renderer/services/progress-bar.service';
import { useTranslation } from 'renderer/hooks/use-translation.hook';

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
  const notificationService = NotificationService.getInstance();
  const bsDownloaderService = BsDownloaderService.getInstance();
  const progressService = ProgressBarService.getInstance();

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
    else if(id === 1){
      window.electron.ipcRenderer.sendMessage("bs-version.open-folder", state);
    }
  }

  const verifyFiles = () => {
    progressService.show(bsDownloaderService.downloadProgress$);
    bsDownloaderService.download(state).then(res => { 
      progressService.hide(true);
      if(!res.success){ notificationService.notifyError({title: "Unable to verify", desc: "Unable to verify, please try later"}); }
      else(notificationService.notifySuccess({title: "Verification complete"}));
    })
  }
  
  const launchBs = () => {
    bsLauncherService.launch(state, oculusMode, desktopMode, debugMode).then(res => {
      if(!res.success){ notificationService.notifyError({title: 'Unable to launch', desc: res.error.title}); }
      else if(res.data === "STEAM_NOT_RUNNING"){ notificationService.notifyWarning({title: "Steam not running", desc: "Steam must be running to launch Beat Saber."}); }
      else if(res.data === "BS_ALREADY_RUNNING"){ notificationService.notifyWarning({title: "Beat Saber already running", desc: "Please close Beat Saber to launch."}); }
      else if(res.data === "EXE_NOT_FINDED"){
        notificationService.notifyError({title: "Files missing", desc: "Some files are missing, please verify the download", actions: [{id: "0", title:"Verfiy"}]}).then(res => {
          if(res !== "0"){ return; }
          verifyFiles();
        });
      }
      else if(res.data === "LAUNCHED"){ notificationService.notifySuccess({title: "Launching..."}) }
      else(notificationService.notifyError({title: res.data || res.error.title}));
    });
  }

  return (
    <>
      <BsmImage className="absolute w-full h-full top-0 left-0 object-cover" image={state.ReleaseImg || DefautVersionImage} errorImage={DefautVersionImage}/>
      <div className="relative flex items-center flex-col w-full h-full text-gray-200 backdrop-blur-lg">
        <BsmImage className='relative object-cover h-28' image={BSLogo}/>
        <h1 className='relative text-4xl font-bold italic -top-3'>{state.BSVersion}</h1>
        <TabNavBar className='mt-3' tabsText={["misc.launch", "misc.maps", "misc.mods"]} onTabChange={(i : number) => setCurrentTabIndex(i)}/>
        <div className='mt-2 w-full grow flex transition-transform duration-300 pt-5' style={{transform: `translate(${-(currentTabIndex * 100)}%, 0)`}}>
          <div className='w-full shrink-0 items-center relative flex flex-col justify-start -top-2'>
            <div className='grid grid-flow-col grid-cols-3 gap-6'>
              <ToogleLunchMod icon='oculus' onClick={() => setMode(LaunchMods.OCULUS_MOD, !oculusMode)} active={oculusMode} text="pages.version-viewer.launch-mods.oculus"/>
              <ToogleLunchMod icon='desktop' onClick={() => setMode(LaunchMods.DESKTOP_MOD, !desktopMode)} active={desktopMode} text="pages.version-viewer.launch-mods.desktop"/>
              <ToogleLunchMod icon='terminal' onClick={() => setMode(LaunchMods.DEBUG_MOD, !debugMode)} active={debugMode} text="pages.version-viewer.launch-mods.debug"/>
            </div>
            <div className='grow flex justify-center items-center'>
              <BsmButton onClick={launchBs} className='relative text-5xl text-gray-800 dark:text-gray-200 bg-light-main-color-2 dark:bg-main-color-2 font-bold tracking-wide pt-1 pb-3 px-7 rounded-lg shadow-md italic shadow-black active:scale-90 transition-transform' text="misc.launch"/>
            </div>
          </div>
          <div className='shrink-0 w-full h-full flex justify-center'>
            <div className='p-4 bg-light-main-color-2 dark:bg-main-color-2 h-fit rounded-md'>
              <img src={wipGif} alt="" />
              <span className='block w-full text-center font-bold mt-2 text-gray-800 dark:text-white'>Work In Progress</span>
            </div>
          </div>
          <div className='shrink-0 w-full h-full flex justify-center'>
            <div className='p-4 bg-light-main-color-2 dark:bg-main-color-2 h-fit rounded-md'>
              <img src={wipGif} alt="" />
              <span className='block w-full text-center font-bold mt-2 text-gray-800 dark:text-white'>Work In Progress</span>
            </div>
          </div>
        </div>
      </div>
      <BsmDropdownButton className='absolute top-5 right-5 h-9 w-9' onItemClick={dropDownActions} items={[
          {id: 1, text: "pages.version-viewer.dropdown.open-folder", icon: "folder"},
          {id: 2, text: "pages.version-viewer.dropdown.verify-files", icon: "folder"},
          {id: 3, text: "pages.version-viewer.dropdown.uninstall", icon:"trash"}
        ]}/>
    </>
  )
}

function ToogleLunchMod(props: {onClick: Function, active: boolean, text: string, icon: BsmIconType}) {

   const t = useTranslation();

  return (
    <div className={`relative rounded-full cursor-pointer group active:scale-95 transition-transform ${!props.active && "shadow-md shadow-black"}`} onClick={() => props.onClick()}>
      <div className={`absolute glow-on-hover rounded-full ${props.active && "opacity-100 blur-[2px]"}`}></div>
      <div className='w-full h-full pl-6 pr-6 flex justify-center items-center bg-light-main-color-2 dark:bg-main-color-2 p-3 rounded-full text-gray-800 dark:text-white group-hover:bg-light-main-color-1 dark:group-hover:bg-main-color-1'>
        <BsmIcon icon={props.icon} className='mr-1 h-7 text-gray-800 dark:text-white'/>
        <span className='w-fit min-w-fit h-full text-lg font-bold uppercase tracking-wide italic'>{t(props.text)}</span>
      </div>
    </div>
  );
}
