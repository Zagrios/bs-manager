import { AvailableVersionsSlider } from "../components/available-versions/available-versions-slider.component";
import { Slideshow } from "renderer/components/slideshow/slideshow.component";
import { createContext, useCallback, useMemo } from "react";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { lastValueFrom } from "rxjs";
import { useService } from "renderer/hooks/use-service.hook";
import { BSVersion } from "shared/bs-version.interface";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { BsDownloaderService } from "renderer/services/bs-version-download/bs-downloader.service";
import { logRenderError } from "renderer";
import { ModalService } from "renderer/services/modale.service";
import { ModsVersionCompareModal } from "renderer/components/modal/modal-types/mods/mods-version-compare-modal.component";

export const AvailableVersionsContext = createContext<{
    startDownload: (version: BSVersion) => void;
    showAvailableMods: (version: BSVersion) => void;
    downloading: boolean;
}>(null);

export function AvailableVersionsList() {

    const bsDownloader = useService(BsDownloaderService);
    const versionManager = useService(BSVersionManagerService);
    const modals = useService(ModalService);

    const downloading = useObservable(() => bsDownloader.busy$, bsDownloader.busy);
    const t = useTranslation();

    const startDownload = useCallback((version: BSVersion) => {
        return bsDownloader.downloadVersion(version).catch(logRenderError);
    }, [bsDownloader]);

    const importVersion = () => {
        return lastValueFrom(versionManager.importVersion()).catch(() => {});
    };

    const showAvailableMods = useCallback((version: BSVersion) => {
        modals.openModal(ModsVersionCompareModal, { data: { version } });
    }, [modals]);

    const contextValue = useMemo(() => ({
        startDownload,
        showAvailableMods,
        downloading,
    }), [downloading, showAvailableMods, startDownload]);

    const refreshVersions = () => {
        return Promise.all([
            versionManager.refreshAvailableVersions(),
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
