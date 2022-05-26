import { useState } from "react";
import { ModalExitCode, ModalResponse } from "renderer/services/modale.service";
import BeatImpatient from '../../../../../assets/beat-impatient.png'

export function LoginModal({resolver}: {resolver: (x: ModalResponse) => void}) {

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [stay, setStay] = useState(false);

    const loggin = () => resolver({exitCode: ModalExitCode.COMPLETED, data:{username, password, stay}});
    const cancel = () => resolver({exitCode: ModalExitCode.CANCELED});

  return (
    <form className="p-4 bg-main-color-2 text-gray-200 overflow-hidden rounded-md shadow-lg shadow-black">
        <h1 className="w-full text-center font-bold text-2xl">Connect to Steam</h1>
        <div className="w-full flex justify-center content-center items-center">
            <img className="aspect-square object-cover w-24" src={BeatImpatient} />
        </div>
        <div className="flex flex-col mb-2">
            <label className="font-bold" htmlFor="username">Username</label>
            <input className="bg-main-color-3 p-1 pr-2 pl-2 rounded-md" onChange={e => setUsername(e.target.value)} value={username} type="text" name="username" id="username" placeholder="Enter your username"/>
        </div>
        <div className="flex flex-col">
            <label className="font-bold" htmlFor="password">Password</label>
            <input className="bg-main-color-3 p-1 pr-2 pl-2 rounded-md" onChange={e => setPassword(e.target.value)} value={password} type="password" name="password" id="password" placeholder="Enter your password"/>
        </div>
        <div className="flex items-center content-center justify-start mt-2 mb-2">
            <input onChange={e => setStay(e.target.checked)} checked={stay} className="mr-1" type="checkbox" name="stay" id="stay" />
            <label htmlFor="stay">Stay connected</label>
        </div>
        <div className="w-full flex justify-center items-center content-center">
            <button onClick={(e) => {e.preventDefault(); cancel()}} className="mr-4">Cancel</button>
            <button onClick={(e) => {e.preventDefault(); loggin()}}>LogIn</button>
        </div>
    </form>
  )
}
