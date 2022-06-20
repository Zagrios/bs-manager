import { FaPlus, } from 'react-icons/fa';
import { AiFillSetting } from 'react-icons/ai'
import './nav-bar.component.css'
import BsVersionItem from './bs-version-item.component';
import { BSVersion } from '../../../main/services/bs-version-manager.service';
import { useEffect, useState } from 'react';
import { BSVersionManagerService } from '../../services/bs-version-manager.service';
import { Link } from 'react-router-dom';
import { ConfigurationService } from 'renderer/services/configuration.service';

export function NavBar() {

  const configService = ConfigurationService.getInstance();

  const [installedVersions, setInstalledVersions] = useState([] as BSVersion[]);

  const [firstColor, setFirstColor] = useState(configService.get("first-color") || "#3b82ff");
  const [secondColor, setSecondColor] = useState(configService.get("second-color") || "#ff4444");

  useEffect(() => {
    BSVersionManagerService.getInstance().installedVersions$.subscribe(versions => {
      setInstalledVersions([]);
      setInstalledVersions(versions);
    });

    configService.watch("first-color").subscribe(hex => setFirstColor(hex));
    configService.watch("second-color").subscribe(hex => setSecondColor(hex));
  }, [])

  return (
    <div id='nav-bar' className='z-10 flex flex-col h-full max-h-full items-center p-1 bg-gray-200 dark:bg-main-color-1'>
      <div className='w-full flex items-start content-start justify-center relative mb-3'>
        <div className='relative aspect-square w-16'>
          <span id='logo-bottom' className='aspect-square w-16' style={{backgroundColor: firstColor}}> </span>
          <span id='logo-top' className='bg-red-500 aspect-square w-16' style={{backgroundColor: secondColor}}> </span>
        </div>
      </div>
      <div id='versions' className='w-fit relative left-[2px] grow overflow-y-hidden scrollbar-track-transparent scrollbar-thin scrollbar-thumb-neutral-900 hover:overflow-y-scroll'>
      {installedVersions.map((version) => <BsVersionItem key={JSON.stringify(version)} version={version}/>)}
      </div>
      <div className='w-full p-2 flex flex-col items-center content-center justify-start'>
        <Link className='mb-2' to={"blah"}>
          <FaPlus className='text-2xl text-blue-500 drop-shadow-lg'/>
        </Link>
        <Link to={"settings"}>
          <AiFillSetting className='text-2xl text-blue-500 drop-shadow-lg'/>
        </Link>
      </div>
    </div>
  )
}
