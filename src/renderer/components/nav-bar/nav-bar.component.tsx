import { FaPlus, } from 'react-icons/fa';
import { AiFillSetting } from 'react-icons/ai'
import './nav-bar.component.css'
import BsVersionItem from './bs-version-item.component';
import { BSVersion } from '../../../main/services/bs-version-manager.service';
import { useEffect, useState } from 'react';
import { BSVersionManagerService } from '../../services/bs-version-manager.service';
import { Link } from 'react-router-dom';

export function NavBar() {

  const [installedVersions, setInstalledVersions] = useState([] as BSVersion[]);

  useEffect(() => {
    BSVersionManagerService.getInstance().installedVersions$.subscribe(versions => {
      setInstalledVersions([]);
      setInstalledVersions(versions);
    })
  }, [])

  return (
    <div id='nav-bar' className='z-10 flex flex-col h-full max-h-full items-center p-1 bg-gray-200 dark:bg-main-color-1'>
      <div className='w-full flex items-start content-start justify-center relative mb-3'>
        <div className='relative aspect-square w-16'>
          <span id='logo-bottom' className='bg-blue-500 aspect-square w-16'> </span>
          <span id='logo-top' className='bg-red-500 aspect-square w-16'> </span>
        </div>
      </div>
      <div id='versions' className='w-fit relative left-[2px] grow overflow-y-hidden scrollbar-track-transparent scrollbar-thin scrollbar-thumb-neutral-900 hover:overflow-y-scroll'>
      {installedVersions.map((version) => <BsVersionItem key={JSON.stringify(version)} version={version}/>)}
      </div>
      <div className='w-full p-2 flex flex-col items-center content-center justify-start'>
        <span className='cursor-pointer mb-3'>
          <Link to={"blah"}>
            <FaPlus className='text-2xl text-blue-500 drop-shadow-lg'/>
          </Link>

        </span>
        <span className='cursor-pointer'>
          <AiFillSetting className='text-2xl text-blue-500 drop-shadow-lg'/>
        </span>

      </div>
    </div>
  )
}
