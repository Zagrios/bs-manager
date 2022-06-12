import { ModalExitCode, ModalResponse } from "../../../services/modale.service";
import { useState } from "react";
import BeatConflict from "../../../../../assets/beat-conflict.png"

export function GuardModal({resolver}: {resolver: (x: ModalResponse) => void}) {

    const [guardCode, setGuardCode] = useState('');

    const login = () => {
      if(!guardCode){ return; }
      resolver({exitCode: ModalExitCode.COMPLETED, data: guardCode});
    }
    const cancel = () => resolver({exitCode: ModalExitCode.CANCELED});
    

  return (
    <form className="p-4 bg-main-color-2 text-gray-200 overflow-hidden rounded-md shadow-lg shadow-black" onSubmit={(e) => {e.preventDefault(); login();}}>
        <h1 className="w-full text-center font-bold text-2xl">Steam Guard</h1>
        <div className="w-full flex justify-center content-center items-center">
            <img className="aspect-square object-cover w-28" src={BeatConflict} />
        </div>
        <div className="flex flex-col">
            <label className="font-bold" htmlFor="guard">Guard Code</label>
            <input className="bg-main-color-3 p-1 pr-2 pl-2 rounded-md" onChange={e => setGuardCode(e.target.value)} value={guardCode} type="guard" name="guard" id="guard" placeholder="Enter your Guard code"/>
        </div>
        <div className="mt-3 w-full flex justify-center items-center content-center">
            <span onClick={cancel} className="font-bold uppercase grow mr-4 border-2 pr-3 pl-3 pt-[2px] pb-[2px] cursor-pointer rounded-md border-gray-300 hover:bg-gray-300 hover:text-black transition-colors">Cancel</span>
            <button type="submit" className="relative font-bold uppercase grow">
              <div className="absolute glow-on-hover opacity-100 z-[1] w-[calc(100%+4px)] h-[calc(100%+4px)] top-[-2px] left-[-2px] blur-none rounded-md"></div>
              <div className="relative tracking-wide rounded-md h-full w-full z-[1] pr-3 pl-3 pt-[2px] pb-[2px] bg-main-color-2 hover:text-black hover:bg-transparent transition-colors">login</div>
            </button>
        </div>
    </form>
  )
}
