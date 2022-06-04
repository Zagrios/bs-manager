import { BSVersion } from "main/services/bs-version-manager.service";
import test from "../../../../assets/slideshow-images/image-7.png"

export function AvailableVersionItem(props: {version: BSVersion}) {
  return (
    <div className="relative m-3 flex flex-col overflow-hidden rounded-md w-72 h-60 bg-main-color-2 shadow-lg shadow-gray-900">
      <img src="https://cdn.akamai.steamstatic.com/steamcommunity/public/images/clans/32055887/8486ec6eb3b6e28eaac59d414dd20bd18eed36d8_400x225.png" className="absolute top-0 right-0 w-full h-full opacity-40 blur-xl object-cover"></img>
      <img src="https://cdn.akamai.steamstatic.com/steamcommunity/public/images/clans/32055887/8486ec6eb3b6e28eaac59d414dd20bd18eed36d8_400x225.png" className="bg-black w-full h-3/4 object-cover"/>
      <div className="relative z-[1] p-2 w-full flex items-center justify-between grow">
        <div>
          <span className="block text-xl font-bold text-white tracking-wider">{props.version.BSVersion}</span>
          <span className="text-sm text-gray-400">jeu. 19 mai 2022</span>
        </div>
        <div>
          DL
        </div>
      </div>
    </div>
  )
}
