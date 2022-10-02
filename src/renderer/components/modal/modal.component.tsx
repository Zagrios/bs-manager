import { ModalExitCode, ModalService, ModalType } from "renderer/services/modale.service";
import { AnimatePresence, motion } from "framer-motion";
import { LoginModal } from "./modal-types/login-modal.component";
import { GuardModal } from "./modal-types/guard-modal.component";
import { UninstallModal } from "./modal-types/uninstall-modal.component";
import { InstallationFolderModal } from "./modal-types/installation-folder-modal.component";
import { EditVersionModal } from "./modal-types/edit-version-modal.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { UninstallModModal } from "./modal-types/uninstall-mod-modal.component";

export function Modal() {

   const modalSevice = ModalService.getInsance();

   const modalType = useObservable(modalSevice.modalType$);
   const {firstColor, secondColor} = useThemeColor();

  return  (
      <AnimatePresence>
         {modalType && (
            <div className="top-0 absolute w-screen h-screen flex content-center items-center justify-center z-50">
               <motion.span key="modal-overlay" onClick={() => modalSevice.resolve({exitCode: ModalExitCode.NO_CHOICE})} className="absolute top-0 bottom-0 right-0 left-0 bg-black" initial={{opacity: 0}} animate={{opacity: modalType && .60}} exit={{opacity: 0}} transition={{duration: .2}}/>
               <motion.div key="modal" initial={{y: "100vh"}} animate={{y: 0}} exit={{y: "100vh"}}>
                  <div className="relative p-4 text-gray-200 overflow-hidden rounded-md shadow-lg shadow-black bg-gradient-to-br from-light-main-color-3 to-light-main-color-2 dark:from-main-color-3 dark:to-main-color-2">
                     <span className="absolute top-0 w-full left-0 h-1" style={{backgroundImage: `linear-gradient(to right, ${firstColor}, ${secondColor})`}}/>
                     {modalType === ModalType.STEAM_LOGIN && <LoginModal resolver={modalSevice.getResolver()}/>}
                     {modalType === ModalType.GUARD_CODE && <GuardModal resolver={modalSevice.getResolver()}/>}
                     {modalType === ModalType.UNINSTALL && <UninstallModal resolver={modalSevice.getResolver()}/>}
                     {modalType === ModalType.INSTALLATION_FOLDER && <InstallationFolderModal resolver={modalSevice.getResolver()}/>}
                     {modalType === ModalType.EDIT_VERSION && <EditVersionModal resolver={modalSevice.getResolver()}/>}
                     {modalType === ModalType.CLONE_VERSION && <EditVersionModal resolver={modalSevice.getResolver()} clone/>}
                     {modalType === ModalType.UNINSTALL_MOD && <UninstallModModal resolver={modalSevice.getResolver()}/>}
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
  )
}
