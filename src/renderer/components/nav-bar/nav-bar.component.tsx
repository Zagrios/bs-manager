import { FaPlus, } from 'react-icons/fa';
import { AiFillSetting } from 'react-icons/ai'
import './nav-bar.component.css'
import { useSelector } from 'react-redux';
import BsVersionItem from './bs-version-item.component';
import { BSVersion } from 'main/services/bs-version-manager.service';

export function NavBar() {

  const { installedVersions }: {installedVersions: BSVersion[]} = useSelector((state: any) => ({...state.installedBSReducer}));

  console.log(installedVersions);

  return (
    <div id='nav-bar' className='flex flex-col items-center w-fit h-full max-h-full p-2 bg-gray-200 dark:bg-[#202225]'>
      <div className='w-full flex items-start content-start justify-center relative mb-3'>
        <div className='relative aspect-square w-16'>
          <span id='logo-bottom' className='bg-blue-500 aspect-square w-16'> </span>
          <span id='logo-top' className='bg-red-500 aspect-square w-16'> </span>
        </div>
      </div>
      <div id='versions' className='relative w-full left-[2px] grow overflow-y-hidden scrollbar-th scrollbar-track-transparent scrollbar-thin scrollbar-thumb-neutral-900 hover:overflow-y-scroll'>
        {installedVersions.map((version, index) => <BsVersionItem key={index} version={version}/>)}
      </div>
      <div className='w-full p-2 flex flex-col items-center content-center justify-start'>
        <span className='cursor-pointer mb-3'>
          <FaPlus className='text-2xl text-blue-500 drop-shadow-lg'/>
        </span>
        <span className='cursor-pointer'>
          <AiFillSetting className='text-2xl text-blue-500 drop-shadow-lg'/>
        </span>

      </div>
    </div>
  )
}
