import { BSVersion } from 'shared/bs-version.interface';
import { useEffect, useState, memo } from "react";
import { BsDownloaderService } from "renderer/services/bs-downloader.service";
import { distinctUntilChanged } from "rxjs/operators";
import defaultImage from '../../../../assets/images/default-version-img.jpg'
import dateFormat from "dateformat";
import { BsmImage } from "../shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { LinkOpenerService } from 'renderer/services/link-opener.service';
import { motion } from 'framer-motion';
import { GlowEffect } from '../shared/glow-effect.component';

export const AvailableVersionItem = memo(function AvailableVersionItem(props: {version: BSVersion}) {

  const bsDownloaderService = BsDownloaderService.getInstance();
  const linkOpener = LinkOpenerService.getInstance();

  const [selected, setSelected] = useState(false);
  const [hovered, setHovered] = useState(false);
  const t = useTranslation();

  const formatedDate = (() => { return dateFormat(+props.version.ReleaseDate*1000, "ddd. d mmm yyyy"); })()

  const toggleSelect = () => {
    if(bsDownloaderService.isDownloading){ return; }
    if(selected){ bsDownloaderService.selectedBsVersion$.next(null); }
    else{ bsDownloaderService.selectedBsVersion$.next(props.version); }
  }

  const openReleasePage = () =>  { linkOpener.open(props.version.ReleaseURL) }

  useEffect(() => {
    const sub = bsDownloaderService.selectedBsVersion$.pipe(distinctUntilChanged()).subscribe((version) => {
      setSelected(version?.BSVersion === props.version.BSVersion)
    });

    return () => {
      sub.unsubscribe();
    }
  }, [])

    return (
        <motion.li className="group relative w-72 h-60 transition-transform active:scale-[.98]" onClick={toggleSelect} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}>
            <GlowEffect visible={hovered || selected} className="absolute"/>
            <div className={`relative flex flex-col overflow-hidden rounded-md w-72 h-60 cursor-pointer group-hover:shadow-none duration-300 bg-light-main-color-2 dark:bg-main-color-2 ${!selected && "shadow-lg shadow-gray-900"}`}>
                <BsmImage image={props.version.ReleaseImg ? props.version.ReleaseImg : defaultImage} errorImage={defaultImage} placeholder={defaultImage} className="absolute top-0 right-0 w-full h-full opacity-40 blur-xl object-cover" loading="lazy"/>
                <BsmImage image={props.version.ReleaseImg ? props.version.ReleaseImg : defaultImage} errorImage={defaultImage} placeholder={defaultImage} className="bg-black w-full h-3/4 object-cover" loading="lazy"/>
                <div className="z-[1] p-2 w-full flex items-center justify-between grow">
                    <div>
                        <h2 className="block text-xl font-bold text-white tracking-wider">{props.version.BSVersion}</h2>
                        <span className="text-sm text-gray-700 dark:text-gray-400">{formatedDate}</span>
                    </div>
                    { props.version.ReleaseURL && (
                        <a onClickCapture={e => { e.stopPropagation(); openReleasePage(); }} className="flex flex-row justify-between items-center rounded-full bg-black bg-opacity-30 text-white pb-px hover:bg-opacity-50">
                            <BsmIcon icon="steam" className="w-[25px] h-[25px] transition-transform group-hover:rotate-[-360deg] duration-300"/>
                            <span className="relative -left-px text-sm w-fit max-w-0 text-center overflow-hidden h-full whitespace-nowrap pb-[3px] transition-all group-hover:max-w-[200px] group-hover:px-1 duration-300">{t("pages.available-versions.steam-release")}</span>
                        </a>
                    )}
                </div>
            </div>
        </motion.li>
    )
})
