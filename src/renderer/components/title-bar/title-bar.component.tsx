import { useState } from 'react';
import './title-bar.component.css'

export default function TitleBar() {

  const [maximized, setMaximized] = useState(false);

  const closeWindow = () => {
    window.electron.ipcRenderer.sendMessage('window.close', null);
  }

  const maximizeWindow = () => {
    window.electron.ipcRenderer.sendMessage('window.maximize', null);
  }

  const minimizeWindow = () => {
    window.electron.ipcRenderer.sendMessage('window.minimize', null);
  }

  const resetWindow = () => {
    window.electron.ipcRenderer.sendMessage('window.reset', null);
  }

  const toogleMaximize = () => {
    if(maximized){ resetWindow(); }
    else{ maximizeWindow(); }
    setMaximized(!maximized);
  }

  return (
    <header id="titlebar" className="min-h-[22px] bg-light-main-color-1 dark:bg-main-color-1 w-screen h-10 flex content-center items-center justify-start z-10">
      <div id="drag-region" className='grow basis-0'>
        <div id="window-title" className='pl-1'>
          <span className='text-gray-800 dark:text-gray-100 font-bold text-xs italic'>BSManager</span>
        </div>
      </div>
      <div id="window-controls" className=''>
          <div onClick={minimizeWindow} className="button button text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-[#4F545C] cursor-pointer" id="min-button" >
            <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12"><rect fill="currentColor" width="10" height="1" x="1" y="6"> </rect></svg>
          </div>
          <div onClick={toogleMaximize} className="button text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-[#4F545C] cursor-pointer" id="max-button">
          <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12"><rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor"> </rect></svg>
          </div>
          <div onClick={closeWindow} className="button text-gray-800 dark:text-gray-200 cursor-pointer" id="close-button" draggable="false">
            <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12"><polygon fill="currentColor" fillRule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"> </polygon></svg>
          </div>
        </div>
    </header>
  )
}
