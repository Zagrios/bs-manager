import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
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

  return (
    <form onSubmit={(e) => {e.preventDefault(); loggin();}}>
        <h1 className="text-3xl uppercase tracking-wide w-full text-center">Steam Login</h1>
        <BsmImage className="mx-auto h-20" image={BeatImpatient} />
        <div className="mb-2">
            <label className="block font-bold cursor-pointer tracking-wide" htmlFor="username">Username</label>
            <input className="w-full bg-main-color-1 px-1 py-[2px] rounded-md outline-none" onChange={e => setUsername(e.target.value)} value={username} type="text" name="username" id="username" placeholder="Enter your username"/>
        </div>
        <div className="mb-2">
            <label className="block font-bold cursor-pointer tracking-wide" htmlFor="password">Password</label>
            <input className="w-full bg-main-color-1 px-1 py-[2px] rounded-md outline-none" onChange={e => setPassword(e.target.value)} value={password} type="password" name="password" id="password" placeholder="Enter your password"/>
        </div>
        <div className="flex items-center content-center justify-start mb-3">
            <input onChange={e => setStay(e.target.checked)} checked={stay} className="mr-1" type="checkbox" name="stay" id="stay" />
            <label className="cursor-pointer" htmlFor="stay">Stay connected</label>
        </div>
        <div className="grid grid-flow-col grid-cols-2 gap-4">
            <BsmButton className="rounded-md text-center bg-gray-500 hover:brightness-110 transition-all" onClick={() => {resolver({exitCode: ModalExitCode.CANCELED})}} withBar={false} text="Cancel"/>
            <BsmButton className="rounded-md text-center bg-blue-500 hover:brightness-110 transition-all" type="submit" withBar={false} text="Login"/>
        </div>
    </form>
  )
}
