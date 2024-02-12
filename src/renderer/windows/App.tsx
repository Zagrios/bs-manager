import { NavBar } from "../components/nav-bar/nav-bar.component";
import TitleBar from "../components/title-bar/title-bar.component";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AvailableVersionsList } from "../pages/available-versions-list.components";
import { VersionViewer } from "../pages/version-viewer.component";
import { Modal } from "../components/modal/modal.component";
import { SettingsPage } from "../pages/settings-page.component";
import { BsmProgressBar } from "../components/progress-bar/bsm-progress-bar.component";
import { useEffect } from "react";
import { NotificationOverlay } from "../components/notification/notification-overlay.component";
import { PageStateService } from "../services/page-state.service";
import { SharedContentsPage } from "../pages/shared-contents-page.component";
import "tailwindcss/tailwind.css";
import { BsmIframeView } from "../components/shared/iframe-view.component";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away-subtle.css";
import { MapsManagerService } from "renderer/services/maps-manager.service";
import { PlaylistsManagerService } from "renderer/services/playlists-manager.service";
import { ModelsManagerService } from "renderer/services/models-management/models-manager.service";
import { NotificationService } from "renderer/services/notification.service";
import { lastValueFrom, timer } from "rxjs";
import { ConfigurationService } from "renderer/services/configuration.service";
import { OsDiagnosticService } from "renderer/services/os-diagnostic.service";
import { useService } from "renderer/hooks/use-service.hook";
import { AutoUpdaterService } from "renderer/services/auto-updater.service";
import { gt } from "semver"

export default function App() {
    useService(OsDiagnosticService);
    const pageState = useService(PageStateService);
    const maps = useService(MapsManagerService);
    const playlists = useService(PlaylistsManagerService);
    const models = useService(ModelsManagerService);
    const notification = useService(NotificationService);
    const config = useService(ConfigurationService);
    const autoUpdater = useService(AutoUpdaterService);

    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        checkIsUpdated();
        checkOneClicks();
    }, []);

    const checkIsUpdated = async () => {
        const appVersion = await lastValueFrom(autoUpdater.getAppVersion());
        const lastAppVersion = autoUpdater.getLastAppVersion();

        autoUpdater.setLastAppVersion(appVersion);

        if (lastAppVersion && gt(appVersion, lastAppVersion)) {
            autoUpdater.showChangelog(appVersion);
        }
    };

    const checkOneClicks = async () => {
        if (config.get("not-remind-oneclick") === true) {
            return;
        }

        await timer(3_000).toPromise();

        const oneClicks = await Promise.all([maps.isDeepLinksEnabled(), playlists.isDeepLinksEnabled(), models.isDeepLinksEnabled()]);

        if (!oneClicks.some(enabled => enabled === false)) {
            return;
        }

        const choice = await notification.notifyWarning({
            title: "notifications.settings.additional-content.deep-link.check-all-enabled.title",
            desc: "notifications.settings.additional-content.deep-link.check-all-enabled.description",
            duration: 10_000,
            actions: [
                { id: "0", title: "notifications.settings.additional-content.deep-link.check-all-enabled.actions.settings" },
                { id: "1", title: "notifications.settings.additional-content.deep-link.check-all-enabled.actions.not-remind", cancel: true },
            ],
        });

        if (choice === "0") {
            return navigate("/settings#one-clicks");
        }

        if (choice === "1") {
            config.set("not-remind-oneclick", true);
        }
    };

    useEffect(() => {
        pageState.setLocation(location);

        if (!location.hash) {
            return;
        }

        const hash = location.hash.replace("#", "");
        const el = document.getElementById(hash);

        if (!el) {
            return;
        }

        el.scrollIntoView({ block: "start", behavior: "smooth" });
    }, [location]);

    return (
        <div className="relative w-screen h-screen overflow-hidden flex bg-light-main-color-1 dark:bg-main-color-1 z-0 max-w-full">
            <Modal />
            <NavBar />
            <NotificationOverlay />
            <BsmIframeView />
            <div className="relative flex flex-col grow max-w-full min-w-0">
                <TitleBar template="index.html" />
                <div className="bg-light-main-color-2 dark:bg-main-color-2 relative rounded-tl-lg grow overflow-hidden max-w-full">
                    <Routes>
                        <Route path="/bs-version/:versionNumber" element={<VersionViewer />} />
                        <Route path="/shared" element={<SharedContentsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<AvailableVersionsList />} />
                    </Routes>
                    <BsmProgressBar />
                </div>
            </div>
        </div>
    );
}
