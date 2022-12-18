import { useState } from 'react';
import { IpcService } from 'renderer/services/ipc.service';
import './title-bar.component.css'

export default function TitleBar({template = "main"} : {template?: "update"|"main"|"oneclick"}) {

   const ipcService = IpcService.getInstance();

   const [maximized, setMaximized] = useState(false);

   const closeWindow = () => {
      ipcService.sendLazy('window.close');
   }

   const maximizeWindow = () => {
      ipcService.sendLazy('window.maximize');
   }

   const minimizeWindow = () => {
      ipcService.sendLazy('window.minimize');
   }

   const resetWindow = () => {
      ipcService.sendLazy('window.reset');
   }

   const toogleMaximize = () => {
      if(maximized){ resetWindow(); }
      else{ maximizeWindow(); }
      setMaximized(!maximized);
   }

    if(template === "main"){

        return (
            <header id="titlebar" className="min-h-[22px] bg-light-main-color-1 shrink-0 dark:bg-main-color-1 w-screen h-[22px] flex content-center items-center justify-start z-10">
                <div id="drag-region" className='grow basis-0 h-full'>
                    <div id="window-title" className='pl-1'>
                        <span className='text-gray-800 dark:text-gray-100 font-bold text-xs italic'>BSManager</span>
                    </div>
                </div>
                <div id="window-controls" className="h-full flex shrink-0">
                    <div onClick={minimizeWindow} className="text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-[#4F545C] cursor-pointer w-11 h-full shrink-0 flex justify-center items-center" id="min-button" >
                        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12"><rect fill="currentColor" width="10" height="1" x="1" y="6"> </rect></svg>
                    </div>
                    <div onClick={toogleMaximize} className="text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-[#4F545C] cursor-pointer w-11 h-full shrink-0 flex justify-center items-center" id="max-button">
                        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12"><rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor"> </rect></svg>
                    </div>
                    <div onClick={closeWindow} className="text-gray-800 dark:text-gray-200 cursor-pointer w-11 h-full shrink-0 flex justify-center items-center" id="close-button" draggable="false">
                        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12"><polygon fill="currentColor" fillRule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"> </polygon></svg>
                    </div>
                </div>
            </header>
        );

    }
    if(template === "update"){
        return (
            <header id="titlebar" className="min-h-[22px] bg-transparent w-screen h-[22px] z-10">
                <div id="drag-region" className='grow basis-0 h-full'></div>
            </header>
        )
    }
    if(template === "oneclick"){
        return (
            <header id="titlebar" className="min-h-[22px] bg-transparent w-screen h-[22px] flex content-center items-center justify-start z-10">
                <div id="drag-region" className='grow h-full'>
                    <div id="window-title" className='pl-1'>
                        <span className='text-gray-100 font-bold text-xs italic'>BSManager</span>
                    </div>
                </div>
                <div id="window-controls" className="h-full flex shrink-0">
                    <div onClick={closeWindow} className="text-gray-200 cursor-pointer w-7 h-full shrink-0 flex justify-center items-center rounded-bl-md" id="close-button" draggable="false">
                        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12"><polygon fill="currentColor" fillRule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"> </polygon></svg>
                    </div>
                </div>
            </header>
        );
    }
}
