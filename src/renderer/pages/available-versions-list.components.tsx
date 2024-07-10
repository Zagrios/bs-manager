import { AvailableVersionsSlider } from "../components/available-versions/available-versions-slider.component";
import { Slideshow } from "renderer/components/slideshow/slideshow.component";
import { createContext, useMemo, useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { lastValueFrom, map } from "rxjs";
import { useService } from "renderer/hooks/use-service.hook";
import { BSVersion } from "shared/bs-version.interface";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { BsDownloaderService } from "renderer/services/bs-version-download/bs-downloader.service";
import { logRenderError } from "renderer";

export const AvailableVersionsContext = createContext<{ selectedVersion: BSVersion; setSelectedVersion: (version: BSVersion) => void }>(null);

export function AvailableVersionsList() {

    const bsDownloader = useService(BsDownloaderService);
    const versionManager = useService(BSVersionManagerService);

    const [selectedVersion, setSelectedVersion] = useState<BSVersion>(null);
    const contextValue = useMemo(() => ({ selectedVersion, setSelectedVersion }), [selectedVersion]);

    const downloading = useObservable(() => bsDownloader.downloadingVersion$.pipe(map(v => !!v)));
    const t = useTranslation();

    const startDownload = async () => {

        return bsDownloader.downloadVersion(selectedVersion)
            .catch(logRenderError)
            .finally(() => setSelectedVersion(null));
    };

    const importVersion = () => {
        return lastValueFrom(versionManager.importVersion()).catch(() => {});
    };

    const refreshVersions = () => {
        return Promise.all([
            versionManager.askAvailableVersions(),
            versionManager.askInstalledVersions()
        ]).catch(logRenderError);
    }

    return (
        <div className="relative h-full w-full flex items-center flex-col pt-2">

            <Slideshow className="absolute w-full h-full top-0" />
            <h1 className="text-gray-100 text-2xl mb-4 z-[1]">{t("pages.available-versions.title")}</h1>

            <AvailableVersionsContext.Provider value={contextValue}>
                <AvailableVersionsSlider />
            </AvailableVersionsContext.Provider>

            <AnimatePresence>
                {selectedVersion && !downloading && (
                    <motion.div initial={{ y: "150%" }} animate={{ y: "0%" }} exit={{ y: "150%" }} className="absolute bottom-5" onClick={startDownload}>
                        <BsmButton text="misc.download" className="relative text-gray-800 dark:text-gray-100 rounded-md text-3xl font-bold italic tracking-wide px-3 pb-2 pt-1 shadow-md shadow-black" />
                    </motion.div>
                )}
            </AnimatePresence>

            <BsmDropdownButton
                className="absolute top-5 right-5 h-9 w-9 bg-light-main-color-2 dark:bg-main-color-2 rounded-md"
                icon="settings"
                items={[
                    { icon: "sync", text: "pages.available-versions.dropdown.refresh", onClick: refreshVersions },
                    { icon: "download", text: "pages.available-versions.dropdown.import-version", onClick: importVersion },
                ]}
            />
        </div>
    );
}
