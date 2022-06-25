import { ModalExitCode, ModalResponse } from "../../../services/modale.service";
import { useState } from "react";
import BeatConflict from "../../../../../assets/beat-conflict.png"
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";

export function GuardModal({resolver}: {resolver: (x: ModalResponse) => void}) {

    const [guardCode, setGuardCode] = useState('');

    const login = () => {
      if(!guardCode){ return; }
      resolver({exitCode: ModalExitCode.COMPLETED, data: guardCode});
    }

  return (
    <form onSubmit={(e) => {e.preventDefault(); login();}}>
        <h1 className="text-3xl uppercase tracking-wide w-full text-center">Steam Guard</h1>
        <BsmImage className="mx-auto h-24" image={BeatConflict}/>
        <div className="mb-4">
            <label className="block font-bold tracking-wide" htmlFor="guard">Guard Code</label>
            <input className="w-full bg-main-color-1 px-2 rounded-md py-[2px]" onChange={e => setGuardCode(e.target.value.toUpperCase())} value={guardCode} type="guard" name="guard" id="guard" placeholder="Enter your Guard code"/>
        </div>
        <div className="grid grid-flow-col grid-cols-2 gap-4">
            <BsmButton className="rounded-md text-center bg-gray-500 hover:brightness-110 transition-all" onClick={() => {resolver({exitCode: ModalExitCode.CANCELED})}} withBar={false} text="Cancel"/>
            <BsmButton className="rounded-md text-center bg-blue-500 hover:brightness-110 transition-all" type="submit" withBar={false} text="Login"/>
        </div>
    </form>
  )
}
