import './nav-bar.component.css'
import { BsVersionItem } from './nav-bar-items/bs-version-item.component';
import { BSVersionManagerService } from '../../services/bs-version-manager.service';
import { Link } from 'react-router-dom';
import { BsmIcon } from '../svgs/bsm-icon.component';
import { useObservable } from 'renderer/hooks/use-observable.hook';
import { BsManagerIcon } from './bsmanager-icon.component';
import { MapsNavBarItem } from './nav-bar-items/maps-nav-bar-item.component';
import { NavBarSpliter } from './nav-bar-spliter.component';
import { useThemeColor } from 'renderer/hooks/use-theme-color.hook';
import Tippy from '@tippyjs/react';
import { useTranslation } from 'renderer/hooks/use-translation.hook';
import { I18nService } from 'renderer/services/i18n.service';

export function NavBar() {

    const bsVersionServoce =  BSVersionManagerService.getInstance();

    const installedVersions = useObservable(bsVersionServoce.installedVersions$);
    const color = useThemeColor("first-color");
    const t = useTranslation();

    useObservable(I18nService.getInstance().currentLanguage$)

  return (
    <nav id='nav-bar' className='z-10 flex flex-col h-full max-h-full items-center p-1 bg-light-main-color-1 dark:bg-main-color-1'>
      <BsManagerIcon className='relative aspect-square w-16 h-16 mb-3'/>
      <ol id='versions' className='w-fit max-w-[120px] relative left-[2px] grow overflow-y-hidden scrollbar-track-transparent scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900 hover:overflow-y-scroll'>
         <MapsNavBarItem/>
         <NavBarSpliter/>
         {installedVersions && installedVersions.map((version) => <BsVersionItem key={JSON.stringify(version)} version={version}/>)}
      </ol>
      <NavBarSpliter/>
      <div className='w-full pb-2 flex flex-col items-center content-center justify-start gap-1'>
        <Tippy placement="right" content={t("nav-bar.add-version")}>
            <Link className='rounded-md w-9 h-9 flex justify-center items-center hover:bg-light-main-color-3 dark:hover:bg-main-color-3' to="blah">
                <BsmIcon icon='add' className='text-blue-500 h-[34px]' style={{color}}/>
            </Link>
        </Tippy>
        <Tippy placement="right" content={t("nav-bar.settings")}>
            <Link className='rounded-md w-9 h-9 flex justify-center items-center hover:bg-light-main-color-3 dark:hover:bg-main-color-3' to="settings">
                <BsmIcon icon='settings' className='text-blue-500 h-7' style={{color}}/>
            </Link>
        </Tippy>
      </div>
    </nav>
  )
}
