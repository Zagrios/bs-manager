import { BSVersion } from "main/services/bs-version-manager.service";
import { Link } from "react-router-dom";
import { BsNoteFill } from "../svgs/bs-note-fill.component";
import { SteamIcon } from "../svgs/steam-icon.component";

export default function BsVersionItem(props: {version: BSVersion}) {
  return (
    <div className="relative p-[1px] overflow-hidden rounded-full flex justify-center content-center items-center mb-1">
      <div className="absolute top-0 w-full h-full bg-red-400" style={{transform: 'translate(-50%, 0)'}}></div>
      <Link to={`/bs-version/${props.version.BSVersion}`} state={props.version} className='z-[1] bg-main-color-1 flex cursor-pointer w-full justify-center content-center rounded-full items-center pr-1 pl-2 pt-1 pb-1'>
        {props.version.steam && <SteamIcon className="w-[19px] h-[19px]"/>}
        {!props.version.steam && <BsNoteFill className="w-[19px] h-[19px] text-red-600"/>}
        <span className="flex items-center justify-center content-center shrink-0 grow text-lg text-gray-200 font-bold min-w-0">{props.version.BSVersion}</span>
      </Link>
    </div>
    
  )
}
