import { ModalExitCode, ModalResponse } from "../../../services/modale.service";
import { useState } from "react";
import BeatConflict from "../../../../../assets/beat-conflict.png"

export function GuardModal({resolver}: {resolver: (x: ModalResponse) => void}) {

    const [guardCode, setGuardCode] = useState('');

    const loggin = (e: React.MouseEvent) => {
      e.preventDefault();
      resolver({exitCode: ModalExitCode.COMPLETED, data: guardCode});
    }
    const cancel = (e: React.MouseEvent) => {
      e.preventDefault();
      resolver({exitCode: ModalExitCode.CANCELED});
    }

  return (
    <form className="p-4 bg-main-color-2 text-gray-200 overflow-hidden rounded-md shadow-lg shadow-black">
        <h1 className="w-full text-center font-bold text-2xl">Steam Guard</h1>
        <div className="w-full flex justify-center content-center items-center">
            <img className="aspect-square object-cover w-28" src={BeatConflict} />
        </div>
        <div className="flex flex-col">
            <label className="font-bold" htmlFor="guard">Guard Code</label>
            <input className="bg-main-color-3 p-1 pr-2 pl-2 rounded-md" onChange={e => setGuardCode(e.target.value)} value={guardCode} type="guard" name="guard" id="guard" placeholder="Enter your Guard code"/>
        </div>
        <div className="w-full flex justify-center items-center content-center">
            <button onClick={e => cancel(e)} className="mr-4">Cancel</button>
            <button onClick={e =>loggin(e)}>LogIn</button>
        </div>
    </form>
  )
}
