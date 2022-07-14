import { AvailableVersionsSlider } from "../components/available-versions/available-versions-slider.component";
import { BsDownloaderService } from "../services/bs-downloader.service";
import { Slideshow } from "renderer/components/slideshow/slideshow.component";
import { useEffect, useState } from "react";
import { BSVersion } from "main/services/bs-version-manager.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { AnimatePresence, motion } from "framer-motion";
import { NotificationService } from "renderer/services/notification.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { useObservable } from "renderer/hooks/use-observable.hook";

export function AvailableVersionsList() {

  const slideshowImages = [
    require('../../../assets/images/slideshow-images/image-1-blur.jpg'),
    require('../../../assets/images/slideshow-images/image-2-blur.jpg'),
    require('../../../assets/images/slideshow-images/image-3-blur.jpg'),
    require('../../../assets/images/slideshow-images/image-4-blur.jpg'),
    require('../../../assets/images/slideshow-images/image-5-blur.png'),
    require('../../../assets/images/slideshow-images/image-6-blur.png'),
    require('../../../assets/images/slideshow-images/image-7-blur.png'),
  ];
  const bsDownloaderService: BsDownloaderService = BsDownloaderService.getInstance();
  const progressBarService: ProgressBarService = ProgressBarService.getInstance();
  const notificationService: NotificationService = NotificationService.getInstance();
  const versionManagerService: BSVersionManagerService = BSVersionManagerService.getInstance();

  const [versionSelected, setVersionSelected] = useState(null as BSVersion);
  const progressBarVisible = useObservable(progressBarService.visible$);
  const t = useTranslation();

  const startDownload = () => {
    if(progressBarService.visible$.value){ return; }
    progressBarService.show(bsDownloaderService.downloadProgress$);
    bsDownloaderService.download(versionSelected).then(res => {
      progressBarService.hide(true);

      if(res.success){
        notificationService.notifySuccess({title: "notifications.bs-download.success.titles.download-success", duration: 3000});
      }
    });
  }

  useEffect(() => {
    const versionSelectedSub = bsDownloaderService.selectedBsVersion$.subscribe(version => {
      setVersionSelected(version);
    });

    return () => {
      versionSelectedSub.unsubscribe();
    }
  }, [])


  return (
    <div className="relative h-full w-full flex items-center flex-col pt-2">
      <Slideshow className="absolute w-full h-full top-0" images={slideshowImages}></Slideshow>
      <h1 className="text-gray-100 text-2xl mb-4 z-[1]">{t("pages.available-versions.title")}</h1>
      <AvailableVersionsSlider/>

      <AnimatePresence>
        { versionSelected && !progressBarVisible && (
          <motion.div initial={{y:"150%"}} animate={{y:"0%"}} exit={{y:"150%"}} className="absolute bottom-5" onClick={startDownload}>
            <BsmButton text={versionManagerService.isVersionInstalled(versionSelected) ? "misc.verify" : "misc.download"} className="relative bg-light-main-color-2 text-gray-800 dark:text-gray-100 dark:bg-main-color-2 rounded-md text-3xl font-bold italic tracking-wide px-3 pb-2 pt-1 shadow-md shadow-black"/>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
