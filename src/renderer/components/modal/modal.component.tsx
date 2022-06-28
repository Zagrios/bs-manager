import { ModalExitCode, ModalService, ModalType } from "renderer/services/modale.service";

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion";

import { LoginModal } from "./modal-types/login-modal.component";
import { GuardModal } from "./modal-types/guard-modal.component";
import { UninstallModal } from "./modal-types/uninstall-modal.component";
import { InstallationFolderModal } from "./modal-types/installation-folder-modal.component";

export function Modal() {

  const [modalType, setModalType] = useState(null as ModalType);
  const [modalYOut, setModalYOut] = useState(window.innerHeight);

  const modalSevice = ModalService.getInsance();

  const handleResize = () => setModalYOut(window.innerHeight);

  useEffect(() => {
    modalSevice.modalType$.subscribe(type => {
      setModalType(type);
    });

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    }
  }, [])

  return  (
    <AnimatePresence>
    {modalType && (
      <div className="top-0 absolute w-screen h-screen flex content-center items-center justify-center z-50">
        <motion.span key="modal-overlay" onClick={() => modalSevice.resolve({exitCode: ModalExitCode.NO_CHOICE})} className="absolute top-0 bottom-0 right-0 left-0 bg-black" initial={{opacity: 0}} animate={{opacity: modalType && .60}} exit={{opacity: 0}} transition={{duration: .2}}/>
        <motion.div key="modal" initial={{y: modalYOut}} animate={{y: 0}} exit={{y: modalYOut}}>
          <div className="relative p-4 text-gray-200 overflow-hidden rounded-md shadow-lg shadow-black bg-gradient-to-br from-light-main-color-3 to-light-main-color-2 dark:from-main-color-3 dark:to-main-color-2">
            <span className="absolute bg-gradient-to-r from-blue-500 to-red-500 top-0 w-full left-0 h-1"></span>
            {modalType === ModalType.STEAM_LOGIN && <LoginModal resolver={modalSevice.getResolver()}/>}
            {modalType === ModalType.GUARD_CODE && <GuardModal resolver={modalSevice.getResolver()}/>}
            {modalType === ModalType.UNINSTALL && <UninstallModal resolver={modalSevice.getResolver()}/>}
            {modalType === ModalType.INSTALLATION_FOLDER && <InstallationFolderModal resolver={modalSevice.getResolver()}/>}
          </div>
        </motion.div>
      </div>
    )}
    </AnimatePresence>
  )
}
