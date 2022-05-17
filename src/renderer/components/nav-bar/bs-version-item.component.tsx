import { BSVersion } from "main/services/bs-version-manager.service";
import { Link } from "react-router-dom";
import { BsNoteFill } from "../svgs/bs-note-fill.component";
import { SteamIcon } from "../svgs/steam-icon.component";

export default function BsVersionItem(props: {version: BSVersion}) {
  return (
    <div className='flex cursor-pointer w-max justify-center content-center items-center pr-1 text-red-600'>
      {props.version.steam && <SteamIcon className="w-[19px] h-[19px] mr-1"/>}
      {!props.version.steam && <BsNoteFill className="w-[22px] h-[22px] mr-1"/>}
      <Link to={`/bs-version/${props.version.BSVersion}`} state={props.version} className="shrink-0 text-lg text-gray-200 font-bold min-w-0">{props.version.BSVersion}</Link>
    </div>
  )
}
