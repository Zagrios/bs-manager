import { AvailableVersionsSlider } from "../components/available-versions/available-versions-slider.component";
import { Slideshow } from "renderer/components/slideshow/slideshow.component";
import { createContext, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { lastValueFrom, map } from "rxjs";
import { useService } from "renderer/hooks/use-service.hook";
import { BSVersion } from "shared/bs-version.interface";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { BsDownloaderService } from "renderer/services/bs-version-download/bs-downloader.service";
import { logRenderError } from "renderer";
import { ModalExitCode, ModalService } from "renderer/services/modale.service";
import { BSVersionOutdatedModal } from "renderer/components/modal/modal-types/bs-version-outdated-modal.component";
import { ConfigurationService } from "renderer/services/configuration.service";
import { safeLt } from "shared/helpers/semver.helpers";

export const AvailableVersionsContext = createContext<{ startDownload: (version: BSVersion) => void; downloading: boolean }>(null);

export function AvailableVersionsList() {

    const bsDownloader = useService(BsDownloaderService);
    const versionManager = useService(BSVersionManagerService);
    const modals = useService(ModalService);
    const config = useService(ConfigurationService);

    const downloadPendingRef = useRef(false);
    const [downloadPending, setDownloadPending] = useState(false);

    const downloading = useObservable(() => bsDownloader.downloadingVersion$.pipe(map(v => !!v)), !!bsDownloader.downloadingVersion);
    const downloadUnavailable = downloadPending || downloading;
    const t = useTranslation();

    const startDownload = useCallback(async (version: BSVersion) => {
        if (downloadPendingRef.current || bsDownloader.downloadingVersion) {
            return;
        }

        downloadPendingRef.current = true;
        setDownloadPending(true);

        try {
            const showOutdated = !config.get("not-show-bs-version-outdated-modal");
            const recommendedVersion = versionManager.getRecommendedVersion();

            const isVersionOutdated = safeLt(version.BSVersion, recommendedVersion?.BSVersion);

            if (showOutdated && isVersionOutdated) {

                const res = await modals.openModal(BSVersionOutdatedModal, {data: { outdated: version, recommended: recommendedVersion }});

                if (res.exitCode !== ModalExitCode.COMPLETED) {
                    return;
                }
            }

            const downloadedVersion = await bsDownloader.downloadVersion(version).catch(logRenderError);
            return downloadedVersion;
        } finally {
            downloadPendingRef.current = false;
            setDownloadPending(false);
        }
    }, [config, versionManager, modals, bsDownloader]);

    const contextValue = useMemo(() => ({ startDownload, downloading: downloadUnavailable }), [downloadUnavailable, startDownload]);

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
