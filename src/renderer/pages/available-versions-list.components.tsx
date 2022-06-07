import { AvailableVersionsSlider } from "../components/available-versions/available-versions-slider.component";
import { BsDownloaderService } from "../services/bs-downloader.service";
import { Slideshow } from "renderer/components/slideshow/slideshow.component";
import { useEffect, useState } from "react";
import { BSVersion } from "main/services/bs-version-manager.service";

export function AvailableVersionsList() {

  const slideshowImages = [
    require('../../../assets/slideshow-images/image-1-blur.jpg'),
    require('../../../assets/slideshow-images/image-2-blur.jpg'),
    require('../../../assets/slideshow-images/image-3-blur.jpg'),
    require('../../../assets/slideshow-images/image-4-blur.jpg'),
    require('../../../assets/slideshow-images/image-5-blur.png'),
    require('../../../assets/slideshow-images/image-6-blur.png'),
    require('../../../assets/slideshow-images/image-7-blur.png'),
  ];
  const bsDownloaderService: BsDownloaderService = BsDownloaderService.getInstance();

  const [versionSelected, setVersionSelected] = useState(null as BSVersion);
  const [currentDownload, setCurrentDownload] = useState(null as BSVersion);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const startInstall = () => {
    bsDownloaderService.download();
  }

  useEffect(() => {
    const versionSelectedSub = bsDownloaderService.selectedBsVersion$.subscribe(version => {
      setVersionSelected(version);
    });

    const currentDownloadSub = bsDownloaderService.currentBsVersionDownload$.subscribe(version => {
      setCurrentDownload(version);
    });

    const downloadProgressSub = bsDownloaderService.downloadProgress$.subscribe(progress => {
      setDownloadProgress(progress);
    })

    return () => {
      versionSelectedSub.unsubscribe();
      currentDownloadSub.unsubscribe();
      downloadProgressSub.unsubscribe();
    }
  }, [])
  

  return (
    <div className="relative h-full w-full flex items-center flex-col pt-2">
      <Slideshow className="absolute w-full h-full top-0" images={slideshowImages}></Slideshow>
      <h1 className="text-gray-100 text-2xl mb-4 z-[1]">Select a Version</h1>
      <AvailableVersionsSlider/>
      <div className={`flex items-center content-center justify-center h-10 w-36 absolute bottom-9 z-10 rounded-lg bg-main-color-3 shadow-md shadow-gray-800 cursor-pointer transition-all duration-300 ${!versionSelected && !currentDownload && "translate-y-[100px]"}`}>
        <span className="flex justify-center items-center w-full h-full text-white font-bold tracking-wide text-xl">DOWNLOAD</span>
      </div>
    </div>
  )
}
