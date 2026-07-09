import { BSVersion } from "shared/bs-version.interface";
import { useState, memo, useContext } from "react";
import defaultImage from "../../../../assets/images/default-version-img.jpg";
import dateFormat from "dateformat";
import { BsmImage } from "../shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { motion } from "framer-motion";
import { GlowEffect } from "../shared/glow-effect.component";
import equal from "fast-deep-equal";
import { SteamIcon } from "../svgs/icons/steam-icon.component";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { BsmButton } from "../shared/bsm-button.component";
import { AvailableVersionsContext } from "renderer/pages/available-versions-list.components";

type Props = {
    version: BSVersion;
}

export const AvailableVersionItem = memo(function AvailableVersionItem({version}: Props) {

    const t = useTranslation();
    const context = useContext(AvailableVersionsContext);
    const [hovered, setHovered] = useState(false);
    const formatedDate = useConstant(() => dateFormat(+version.ReleaseDate * 1000, "ddd. d mmm yyyy"));

    return (
        <motion.li className="group/card relative w-72 h-60" onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}>
            <GlowEffect visible={hovered} className="absolute" />
            <div className="relative flex flex-col overflow-hidden rounded-md w-72 h-60 shadow-lg shadow-gray-900 group-hover/card:shadow-none duration-300 bg-light-main-color-2 dark:bg-main-color-2">
                {version.recommended && (
                    <span className="uppercase absolute -rotate-45 top-9 -left-[6.2rem] font-bold text-white bg-red-600 w-full text-center text-xs z-[1] shadow-sm shadow-black py-0.5" title={t("pages.available-versions.recommended-tooltip")}>{t("pages.available-versions.recommended")}</span>
                )}
                <BsmImage image={version.ReleaseImg ? version.ReleaseImg : defaultImage} errorImage={defaultImage} placeholder={defaultImage} className="absolute top-0 right-0 w-full h-full opacity-40 blur-xl object-cover" />
                <BsmImage image={version.ReleaseImg ? version.ReleaseImg : defaultImage} errorImage={defaultImage} placeholder={defaultImage} className="bg-black w-full h-3/4 object-cover" />
                <div className="z-[1] p-2 w-full flex items-center justify-between grow">
                    <div>
                        <h2 className="block text-xl font-bold text-white tracking-wider">{version.BSVersion}</h2>
                        <span className="text-sm text-gray-700 dark:text-gray-400">{formatedDate}</span>
                    </div>
                    <div className="flex flex-row items-center gap-1.5">
                        {version.ReleaseURL && (
                            <a href={version.ReleaseURL} target="_blank" onClick={e => e.stopPropagation()} className="flex flex-row justify-between items-center rounded-full bg-black bg-opacity-30 text-white pb-px overflow-hidden hover:bg-opacity-50" tabIndex={-1}>
                                <SteamIcon className="w-[25px] h-[25px] transition-transform group-hover/card:rotate-[-360deg] duration-300" />
                                <span className="relative -left-px text-sm w-fit max-w-0 text-center overflow-hidden h-full whitespace-nowrap pb-[3px] transition-all group-hover/card:max-w-[200px] group-hover/card:px-1 duration-300">{t("pages.available-versions.steam-release")}</span>
                            </a>
                        )}
                        <BsmButton
                            onClick={e => { e.stopPropagation(); context?.startDownload(version); }}
                            disabled={context?.downloading}
                            title="misc.download"
                            withBar={false}
                            typeColor="none"
                            icon="download"
                            iconClassName="w-[25px] h-[25px] p-[3px] text-white"
                            className="flex items-center justify-center shrink-0 rounded-full bg-black bg-opacity-30 hover:!bg-opacity-50"
                        />
                    </div>
                </div>
            </div>
        </motion.li>
    );
}, equal);
