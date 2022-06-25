import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { ModalExitCode, ModalResponse } from "renderer/services/modale.service";
import BeatConflict from "../../../../../assets/beat-conflict.png"

export function InstallationFolderModal({resolver}: {resolver: (x: ModalResponse) => void}) {



  return (
    <>
        <span className="absolute bg-gradient-to-r from-blue-500 to-red-500 top-0 w-full left-0 h-1"></span>
        <h1 className="text-3xl uppercase tracking-wide w-full text-center">installation folder</h1>
        <BsmImage className="mx-auto h-24" image={BeatConflict}/>
        <p className="max-w-sm">Changing the default installation folder for Beat Saber instances will cause all installed data to be moved to the new folder.</p>
        <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4">
            <BsmButton className="rounded-md text-center bg-gray-500 hover:brightness-110 transition-all" onClick={() => resolver({exitCode: ModalExitCode.CANCELED})} withBar={false} text="Cancel"/>
            <BsmButton className="rounded-md text-center bg-blue-500 hover:brightness-110 transition-all" onClick={() => resolver({exitCode: ModalExitCode.COMPLETED})} withBar={false} text="Choose Folder"/>
        </div>
    </>
  )
}
