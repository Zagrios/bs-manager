import { AvailableVersionsSlider } from "../components/available-versions/available-versions-slider.component";
import { BsDownloaderService } from "../services/bs-downloader.service";
import { Slideshow } from "renderer/components/slideshow/slideshow.component";
import { createContext, useMemo, useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { ModalExitCode, ModalService } from "renderer/services/modale.service";
import { ImportVersionModal } from "renderer/components/modal/modal-types/import-version-modal.component";
import { IpcService } from "renderer/services/ipc.service";
import { NotificationService } from "renderer/services/notification.service";
import { lastValueFrom, map } from "rxjs";
import { useService } from "renderer/hooks/use-service.hook";
import { BSVersion } from "shared/bs-version.interface";
import { useObservable } from "renderer/hooks/use-observable.hook";

export const AvailableVersionsContext = createContext<{ selectedVersion: BSVersion; setSelectedVersion: (version: BSVersion) => void }>(null);

export function AvailableVersionsList() {
    const bsDownloader = useService(BsDownloaderService);
    const versionManager = useService(BSVersionManagerService);
    const progressBar = useService(ProgressBarService);
    const modal = useService(ModalService);
    const ipc = useService(IpcService);
    const installer = useService(BsDownloaderService);
    const notification = useService(NotificationService);

    const [selectedVersion, setSelectedVersion] = useState<BSVersion>(null);
    const contextValue = useMemo(() => ({ selectedVersion, setSelectedVersion }), [selectedVersion]);

    const downloading = useObservable(bsDownloader.currentBsVersionDownload$.pipe(map(v => !!v)));
    const t = useTranslation();

    const startDownload = () => {
        bsDownloader.downloadBsVersion(selectedVersion)
            .catch(() => {})
            .finally(() => setSelectedVersion(null));
    };

    const importVersion = async () => {
        if (!progressBar.require()) {
            return;
        }

        const modalRes = await modal.openModal(ImportVersionModal);

        if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
            return;
        }

        const folderRes = await lastValueFrom(ipc.sendV2<{ canceled: boolean; filePaths: string[] }>("choose-folder"))

        if (!folderRes || folderRes.canceled || !folderRes.filePaths?.length) {
            return;
        }

        notification.notifySuccess({ title: "notifications.bs-import-version.success.start-import.title", desc: "notifications.bs-import-version.success.start-import.desc", duration: 6_000 });

        progressBar.showFake(0.008);

        const toImport = folderRes.filePaths.at(0);

        const imported = await installer.importVersion(toImport);

        if (imported) {
            versionManager.askInstalledVersions();
            notification.notifySuccess({ title: "notifications.bs-import-version.success.imported.title", duration: 3_000 });
            progressBar.complete();
        } else {
            notification.notifyError({ title: "notifications.types.error", desc: "notifications.bs-import-version.errors.import-error.desc" });
        }

        progressBar.hide(true);
    };

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
                    { icon: "sync", text: "pages.available-versions.dropdown.refresh", onClick: () => versionManager.askAvailableVersions() },
                    { icon: "download", text: "pages.available-versions.dropdown.import-version", onClick: importVersion },
                ]}
            />
        </div>
    );
}
