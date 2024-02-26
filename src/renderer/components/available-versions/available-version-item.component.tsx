import { BSVersion } from "shared/bs-version.interface";
import { useState, memo, ComponentProps } from "react";
import defaultImage from "../../../../assets/images/default-version-img.jpg";
import dateFormat from "dateformat";
import { BsmImage } from "../shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { motion } from "framer-motion";
import { GlowEffect } from "../shared/glow-effect.component";
import equal from "fast-deep-equal";
import { SteamIcon } from "../svgs/icons/steam-icon.component";
import { useConstant } from "renderer/hooks/use-constant.hook";

type Props = {
    version: BSVersion;
    selected: boolean;
    onClick: ComponentProps<"li">["onClick"];
}

export const AvailableVersionItem = memo(function AvailableVersionItem({version, selected, onClick}: Props) {

    const t = useTranslation();
    const [hovered, setHovered] = useState(false);
    const formatedDate = useConstant(() => dateFormat(+version.ReleaseDate * 1000, "ddd. d mmm yyyy"));

    return (
        <motion.li className="group relative w-72 h-60 active:scale-[.98]" onClick={onClick} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}>
            <GlowEffect visible={hovered || selected} className="absolute" />
            <div className={`relative flex flex-col overflow-hidden rounded-md w-72 h-60 cursor-pointer group-hover:shadow-none duration-300 bg-light-main-color-2 dark:bg-main-color-2 ${!selected && "shadow-lg shadow-gray-900"}`}>
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
                    {version.ReleaseURL && (
                        <a href={version.ReleaseURL} target="_blank" className="flex flex-row justify-between items-center rounded-full bg-black bg-opacity-30 text-white pb-px overflow-hidden hover:bg-opacity-50" tabIndex={-1}>
                            <SteamIcon className="w-[25px] h-[25px] transition-transform group-hover:rotate-[-360deg] duration-300" />
                            <span className="relative -left-px text-sm w-fit max-w-0 text-center overflow-hidden h-full whitespace-nowrap pb-[3px] transition-all group-hover:max-w-[200px] group-hover:px-1 duration-300">{t("pages.available-versions.steam-release")}</span>
                        </a>
                    )}
                </div>
            </div>
        </motion.li>
    );
}, equal);
