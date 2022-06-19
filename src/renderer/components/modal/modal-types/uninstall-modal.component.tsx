import { ModalExitCode, ModalResponse, ModalService } from "../../../services/modale.service";
import BeatConflict from "../../../../../assets/beat-conflict.png"
import { BSVersion } from "main/services/bs-version-manager.service";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";

export function UninstallModal({resolver}: {resolver: (x: ModalResponse) => void}) {

    const version = ModalService.getInsance().getModalData<BSVersion>();

  return (
    <form className="relative p-4  text-gray-200 overflow-hidden rounded-md shadow-lg shadow-black bg-gradient-to-br from-main-color-3 to-main-color-2" onSubmit={(e) => {e.preventDefault(); resolver({exitCode: ModalExitCode.COMPLETED})}}>
        <span className="absolute bg-gradient-to-r from-blue-500 to-red-500 top-0 w-full left-0 h-1"></span>
        <h1 className="text-3xl uppercase tracking-wide w-full text-center">Uninstall</h1>
        <BsmImage className="mx-auto h-24" image={BeatConflict}/>
        <p className="max-w-sm">Are you sure you want to uninstall BeatSaber {version.BSVersion} ? You will have to re-download it to play it.</p>
        <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4">
            <BsmButton className="rounded-md text-center bg-gray-500 hover:brightness-110 transition-all" onClick={() => {resolver({exitCode: ModalExitCode.CANCELED})}} withBar={false} text="Cancel"/>
            <BsmButton className="rounded-md text-center bg-blue-500 hover:brightness-110 transition-all" type="submit" withBar={false} text="Uninstall"/>
        </div>
    </form>
  )
}
