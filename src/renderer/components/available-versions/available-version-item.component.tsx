import { BSVersion } from "shared/bs-version.interface";
import { memo, useContext } from "react";
import defaultImage from "../../../../assets/images/default-version-img.jpg";
import dateFormat from "dateformat";
import { BsmImage } from "../shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { motion } from "framer-motion";
import equal from "fast-deep-equal";
import { SteamIcon } from "../svgs/icons/steam-icon.component";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { AvailableVersionsContext } from "renderer/pages/available-versions-list.components";
import { DownloadIcon } from "../svgs/icons/download-icon.component";

type Props = {
    version: BSVersion;
}

export const AvailableVersionItem = memo(function AvailableVersionItem({version}: Props) {

    const t = useTranslation();
    const context = useContext(AvailableVersionsContext);
    const formatedDate = useConstant(() => dateFormat(+version.ReleaseDate * 1000, "ddd. d mmm yyyy"));

    return (
        <motion.li
            className="available-version-card group/card relative w-72 h-60"
        >
            <div aria-hidden="true" className="available-version-hover-glow glow-on-hover" />
            <div className="relative flex flex-col overflow-hidden rounded-md w-72 h-60 shadow-lg shadow-gray-900 group-hover/card:shadow-none duration-300 bg-light-main-color-2 dark:bg-main-color-2">
                {version.recommended && (
                    <span className="uppercase absolute -rotate-45 top-9 -left-[6.2rem] font-bold text-white bg-red-600 w-full text-center text-xs z-10 shadow-sm shadow-black py-0.5" title={t("pages.available-versions.recommended-tooltip")}>{t("pages.available-versions.recommended")}</span>
                )}
                <BsmImage image={version.ReleaseImg ? version.ReleaseImg : defaultImage} errorImage={defaultImage} placeholder={defaultImage} className="absolute top-0 right-0 w-full h-full opacity-40 blur-xl object-cover" />
                <BsmImage image={version.ReleaseImg ? version.ReleaseImg : defaultImage} errorImage={defaultImage} placeholder={defaultImage} className="bg-black w-full h-3/4 shrink-0 object-cover" />

                <button
                    type="button"
                    disabled={context?.downloading}
                    aria-label={`${t("misc.download")} ${version.BSVersion}`}
                    title={t("misc.download")}
                    onClick={event => {
                        event.stopPropagation();
                        context?.startDownload(version);
                    }}
                    className="available-version-download-overlay pointer-events-auto absolute inset-x-0 top-0 z-[2] h-3/4 w-full cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {(["left", "right"] as const).map(side => {
                        const leftSlice = side === "left";

                        return (
                            <span
                                key={side}
                                aria-hidden="true"
                                data-download-slice={side}
                                className={`available-version-download-slice available-version-download-slice--${side} absolute inset-0 overflow-hidden bg-gray-950/60 will-change-transform ${leftSlice ? "z-[1]" : "z-[2]"}`}
                                style={{ clipPath: leftSlice ? "polygon(0 0, 59% 0, 41% 100%, 0 100%)" : "polygon(59% 0, 100% 0, 100% 100%, 41% 100%)" }}
                            >
                                <span className="relative flex size-full flex-col items-center justify-center gap-1.5">
                                    <DownloadIcon className="size-10 shrink-0 drop-shadow-[0_0_9px_rgba(255,255,255,0.75)]" />
                                    <span className="whitespace-nowrap text-sm font-black uppercase italic tracking-[0.14em] drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]">{t("misc.download")}</span>
                                </span>
                            </span>
                        );
                    })}
                </button>

                <div className="z-[3] flex h-1/4 w-full shrink-0 items-center justify-between p-2">
                    <div>
                        <h2 className="block text-xl font-bold text-white tracking-wider">{version.BSVersion}</h2>
                        <span className="text-sm text-gray-700 dark:text-gray-400">{formatedDate}</span>
                    </div>
                    {version.ReleaseURL && (
                        <a href={version.ReleaseURL} target="_blank" onClick={e => e.stopPropagation()} className="flex flex-row justify-between items-center rounded-full bg-black bg-opacity-30 text-white pb-px overflow-hidden hover:bg-opacity-50" tabIndex={-1}>
                            <SteamIcon className="w-[25px] h-[25px] transition-transform group-hover/card:rotate-[-360deg] duration-300 motion-reduce:transition-none" />
                            <span className="relative -left-px text-sm w-fit max-w-0 text-center overflow-hidden h-full whitespace-nowrap pb-[3px] transition-all group-hover/card:max-w-[200px] group-hover/card:px-1 duration-300 motion-reduce:transition-none">{t("pages.available-versions.steam-release")}</span>
                        </a>
                    )}
                </div>
            </div>
        </motion.li>
    );
}, equal);
