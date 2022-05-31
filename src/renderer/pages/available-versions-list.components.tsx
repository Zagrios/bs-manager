import { BSVersion } from "../../main/services/bs-version-manager.service";
import { AvailableVersionsArray } from "../components/available-versions-array.component";
import { useState } from "react";
import { BsDownloaderService } from "../services/bs-downloader.service";

export function AvailableVersionsList() {

  const [versionSelected, setVersionSelected] = useState(null as BSVersion);

  const bsDownloaderService: BsDownloaderService = BsDownloaderService.getInstance();

  const selectedVersionCallback = (v: BSVersion) => {
    setVersionSelected(v);
  }

  const startInstall = () => {
    bsDownloaderService.download(versionSelected);
  }

  return (
    <div>
      <h1 className="w-full text-center font-bold text-gray-200 text-3xl mt-6 tracking-wider text-sh mb-5">CHOOSE BS VERSION</h1>
      <AvailableVersionsArray setSelectedVersion={selectedVersionCallback}/>
      { versionSelected && (
        <>
          <h1 className="w-full text-2xl text-gray-200 font-bold text-center mt-5">SELECTED : {versionSelected.BSVersion}</h1>
          <div className="w-full flex flex-col justify-center items-center content-center">
            <button onClick={() => startInstall()} className="m-4 bg-white text-xl font-bold p-3">INSTALL</button>
            <button className="m-4 bg-white text-xl font-bold p-3">VERSION NOTES</button>
          </div>
        </>
      )}
    </div>
  )
}
