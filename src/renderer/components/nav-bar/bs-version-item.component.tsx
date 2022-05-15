import { BSVersion } from "main/services/bs-version-manager.service";
import { Link } from "react-router-dom";

export default function BsVersionItem(props: {version: BSVersion}) {
  return (
    <div className='w-full h-fit pl-1 pr-1 cursor-pointer'>
        <Link to={`/bs-version/${props.version.BSVersion}`} state={props.version} className="block w-full flex justify-center items-center content-center text-lg text-gray-200 font-bold">{props.version.BSVersion}</Link>
    </div>
  )
}
