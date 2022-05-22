import { BSVersion } from "main/services/bs-version-manager.service";
import { Link } from "react-router-dom";
import { BsNoteFill } from "../svgs/bs-note-fill.component";
import { SteamIcon } from "../svgs/steam-icon.component";

export default function BsVersionItem(props: {version: BSVersion}) {
  return (
    <Link to={`/bs-version/${props.version.BSVersion}`} state={props.version} className='flex cursor-pointer w-max justify-center content-center items-center pr-1 mb-3'>
      {props.version.steam && <SteamIcon className="w-[19px] h-[19px] mr-[6px]"/>}
      {!props.version.steam && <BsNoteFill className="w-[19px] h-[19px] mr-[6px] text-red-600"/>}
      <span className="shrink-0 text-lg text-gray-200 font-bold min-w-0">{props.version.BSVersion}</span>
    </Link>
  )
}
