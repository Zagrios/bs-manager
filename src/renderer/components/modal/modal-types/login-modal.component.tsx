import { useState } from "react";
import { ModalExitCode, ModalResponse } from "renderer/services/modale.service";
import BeatImpatient from '../../../../../assets/beat-impatient.png'

export function LoginModal({resolver}: {resolver: (x: ModalResponse) => void}) {

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [stay, setStay] = useState(true);

    const loggin = () => {
        if(!username || !password){ return; }
        resolver({exitCode: ModalExitCode.COMPLETED, data:{username, password, stay}});
    }
    const cancel = () => resolver({exitCode: ModalExitCode.CANCELED});

  return (
    <form className="p-4 bg-main-color-2 text-gray-200 overflow-hidden rounded-md shadow-lg shadow-black" onSubmit={(e) => {e.preventDefault(); loggin();}}>
        <h1 className="w-full text-center font-bold text-2xl">Login to Steam</h1>
        <div className="w-full flex justify-center content-center items-center">
            <img className="aspect-square object-cover w-24" src={BeatImpatient} />
        </div>
        <div className="flex flex-col mb-2">
            <label className="font-bold cursor-pointer" htmlFor="username">Username</label>
            <input className="bg-main-color-3 p-1 pr-2 pl-2 rounded-md outline-none" onChange={e => setUsername(e.target.value)} value={username} type="text" name="username" id="username" placeholder="Enter your username"/>
        </div>
        <div className="flex flex-col">
            <label className="font-bold cursor-pointer" htmlFor="password">Password</label>
            <input className="bg-main-color-3 p-1 pr-2 pl-2 rounded-md outline-none" onChange={e => setPassword(e.target.value)} value={password} type="password" name="password" id="password" placeholder="Enter your password"/>
        </div>
        <div className="flex items-center content-center justify-start mt-2 mb-2">
            <input onChange={e => setStay(e.target.checked)} checked={stay} className="mr-1" type="checkbox" name="stay" id="stay" />
            <label className="cursor-pointer" htmlFor="stay">Stay connected</label>
        </div>
        <div className="mt-3 w-full flex items-center content-center">
            <span onClick={cancel} className="font-bold uppercase tracking-wide grow mr-4 border-2 pr-3 pl-3 pt-[2px] pb-[2px] cursor-pointer rounded-md border-gray-300 hover:bg-gray-300 hover:text-black transition-colors">Cancel</span>
            <button type="submit" className="relative font-bold uppercase grow">
              <div className="absolute glow-on-hover opacity-100 z-[1] w-[calc(100%+4px)] h-[calc(100%+4px)] top-[-2px] left-[-2px] blur-none rounded-md"></div>
              <div className="relative tracking-wide rounded-md h-full w-full z-[1] pr-3 pl-3 pt-[2px] pb-[2px] bg-main-color-2 hover:text-black hover:bg-transparent transition-colors">login</div>
            </button>
        </div>
    </form>
  )
}
