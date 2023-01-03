import { ModalExitCode, ModalService } from "renderer/services/modale.service";
import { AnimatePresence, motion } from "framer-motion";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useEffect } from "react";
import { BsmIcon } from "../svgs/bsm-icon.component";

export function Modal() {

   const modalSevice = ModalService.getInsance();

   const ModalComponent = useObservable(modalSevice.getModalToShow());

   const modalData = modalSevice.getModalData();
   const resolver = modalSevice.getResolver();

   const {firstColor, secondColor} = useThemeColor();

    useEffect(() => {
        
        const onEscape = (e: KeyboardEvent) => {
            if(e.key !== "Escape"){ return; }
            resolver?.(ModalExitCode.NO_CHOICE);
        }

        if(!!ModalComponent){
            window.addEventListener("keyup", onEscape)
        }
        else{
            window.removeEventListener("keyup", onEscape);
        }
   
        return () => {
            window.removeEventListener("keyup", onEscape);
        }
   }, [ModalComponent])
   

  return  (
      <AnimatePresence>
         {ModalComponent && (
            <div className="top-0 absolute w-screen h-screen flex content-center items-center justify-center z-[90]">
               <motion.span key="modal-overlay" onClick={() => modalSevice.resolve({exitCode: ModalExitCode.NO_CHOICE})} className="absolute top-0 bottom-0 right-0 left-0 bg-black" initial={{opacity: 0}} animate={{opacity: ModalComponent && .60}} exit={{opacity: 0}} transition={{duration: .2}}/>
               <motion.div key="modal" initial={{y: "100vh"}} animate={{y: 0}} exit={{y: "100vh"}}>
                  <div className="relative p-4 text-gray-800 dark:text-gray-200 rounded-md shadow-lg shadow-black bg-gradient-to-br from-light-main-color-3 to-light-main-color-2 dark:from-main-color-3 dark:to-main-color-2">
                     <div className="absolute top-0 w-full left-0 h-1 rounded-t-md overflow-hidden">
                        <span className="block w-full h-full" style={{backgroundImage: `linear-gradient(to right, ${firstColor}, ${secondColor})`}}/>
                     </div>
                     <div className="w-2.5 h-2.5 absolute top-2.5 right-1.5 cursor-pointer" onClick={(e) => {e.stopPropagation(); resolver(ModalExitCode.CLOSED)}}>
                        <BsmIcon className="w-full h-full" icon="cross"/>
                     </div>
                     <ModalComponent resolver={resolver} data={modalData}/>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
  )
}
