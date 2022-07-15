import { NavBar } from "./components/nav-bar/nav-bar.component";
import TitleBar from "./components/title-bar/title-bar.component";
import { Routes, Route } from "react-router-dom";
import { AvailableVersionsList } from "./pages/available-versions-list.components";
import { VersionViewer } from "./pages/version-viewer.component";
import { Modal } from "./components/modal/modal.component";
import { SettingsPage } from "./pages/settings-page.component";
import { BsmProgressBar } from "./components/progress-bar/bsm-progress-bar.component";
import { useEffect } from "react";
import { ThemeService } from "./services/theme.service";
import { NotificationOverlay } from "./components/notification/notification-overlay.component";

export default function App() {

  const themeService = ThemeService.getInstance();

  useEffect(() => {
    themeService.theme$.subscribe(() => {
      if(themeService.isDark || (themeService.isOS && window.matchMedia('(prefers-color-scheme: dark)').matches)){ document.documentElement.classList.add('dark'); }
      else { document.documentElement.classList.remove('dark'); }
    });
  }, [])
  

  return (
    <div className="relative w-screen h-screen overflow-hidden flex bg-light-main-color-1 dark:bg-main-color-1 z-0 max-w-full">
      <Modal/>
      <NavBar/>
      <NotificationOverlay/>
      <div className="relative flex flex-col grow max-w-full min-w-0">
        <TitleBar/>
        <div className="bg-light-main-color-2 dark:bg-main-color-2 relative rounded-tl-lg grow overflow-hidden max-w-full">
          <Routes>
            <Route path={"/bs-version/:versionNumber"} element={<VersionViewer/>}/>
            <Route path={"/settings"} element={<SettingsPage/>}/>
            <Route path="*" element={<AvailableVersionsList/>}/>
          </Routes>
          <BsmProgressBar/>
        </div>
      </div>
    </div>
  );
}
