import { BSVersion } from "main/services/bs-version-manager.service";
import bsNote from '../../../../assets/bs-note-fill.svg'
import { Link } from "react-router-dom";

export default function BsVersionItem(props: {version: BSVersion}) {
  return (
    <div className='cursor-pointer flex'>
        <img src={bsNote} alt="" className="inline w-7 aspect-square min-w-0" />
        <Link to={`/bs-version/${props.version.BSVersion}`} state={props.version} className="inline w-max text-lg text-gray-200 font-bold min-w-0">{props.version.BSVersion}</Link>
    </div>
  )
}
