import { ModalExitCode, ModalService, ModalType } from "renderer/services/modale.service";

import { useEffect, useState } from "react"

import { LoginModal } from "./modal-types/login-modal.component";
import { GuardModal } from "./modal-types/guard-modal.component";
import { UninstallModal } from "./modal-types/uninstall-modal.component";

export function Modal() {

  const [modalType, setModalType] = useState(null as ModalType);

  const modalSevice = ModalService.getInsance();

  useEffect(() => {
    modalSevice.modalType$.subscribe(type => {
      setModalType(type);
    })
  }, [])


  return (
    <div className={`absolute w-screen h-screen flex content-center items-center justify-center z-50 ${modalType ? "top-0" : "top-[calc(100%+50px)]"}`}>
      <span onClick={() => modalSevice.resolve({exitCode: ModalExitCode.NO_CHOICE})} className={`absolute top-0 bottom-0 right-0 left-0 transition-opacity bg-black ${modalType ? "opacity-60" : "opacity-0"}`}></span>
      <div className={`absolute transition-transform duration-200 ${modalType ? "translate-y-0" : "translate-y-[200%]"}`}>
          {modalType === ModalType.STEAM_LOGIN && <LoginModal resolver={modalSevice.getResolver()}/>}
          {modalType === ModalType.GUARD_CODE && <GuardModal resolver={modalSevice.getResolver()}/>}
          {modalType === ModalType.UNINSTALL && <UninstallModal resolver={modalSevice.getResolver()}/>}
      </div>
    </div>
  )
}
